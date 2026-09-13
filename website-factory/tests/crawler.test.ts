import { connect } from "node:net";
import { request } from "node:http";
import { describe, it, expect } from "vitest";
import {
  publicUrl,
  isPublicAddress,
  extractPage,
  lighthousePerformance,
  normalizeCrawlOptions,
  pinnedLookup,
  redirectTarget,
  resolvePublicHost,
  startEgressProxy,
} from "../src/crawler.js";

describe("external network boundary", () => {
  it.each([
    "http://localhost",
    "http://127.1",
    "http://2130706433",
    "http://0x7f000001",
    "http://169.254.169.254",
    "http://10.1.2.3",
    "http://[::1]",
    "http://[::ffff:127.0.0.1]",
    "file:///C:/Windows",
    "http://user:pass@example.com",
    "https://example.com:8080",
  ])("rejects unsafe URL %s", (url) => expect(() => publicUrl(url)).toThrow());
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.2.1",
    "100.64.0.1",
    "224.0.0.1",
    "::1",
    "fe80::1",
    "fc00::1",
    "::ffff:10.0.0.1",
  ])("rejects non-public address %s", (ip) =>
    expect(isPublicAddress(ip)).toBe(false),
  );
  it("normalizes URLs without treating a .ch domain as Swiss seat evidence", () =>
    expect(publicUrl("https://example.ch/#content").href).toBe(
      "https://example.ch/",
    ));
  it("accepts a public address", () =>
    expect(isPublicAddress("1.1.1.1")).toBe(true));
  it("rejects a hostname when DNS returns any private address", async () => {
    const resolver = async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ];
    await expect(
      resolvePublicHost("example.test", resolver as never),
    ).rejects.toThrow(/public/i);
  });
  it("returns the pinned address list requested by Node 24", async () => {
    const lookup = pinnedLookup({ address: "93.184.216.34", family: 4 });
    const addresses = await new Promise((resolve, reject) =>
      lookup("example.test", { all: true }, (error, value) =>
        error ? reject(error) : resolve(value),
      ),
    );
    expect(addresses).toEqual([{ address: "93.184.216.34", family: 4 }]);
  });
  it("blocks CONNECT tunnels to loopback before opening an upstream socket", async () => {
    const proxy = await startEgressProxy({
      timeoutMs: 1000,
      maxRequests: 2,
      maxBytes: 1024,
      deadline: Date.now() + 5000,
    });
    try {
      const endpoint = new URL(proxy.url);
      const reply = await new Promise<string>((resolve, reject) => {
        const socket = connect(Number(endpoint.port), endpoint.hostname, () =>
          socket.write(
            "CONNECT 127.0.0.1:443 HTTP/1.1\r\nHost: 127.0.0.1:443\r\n\r\n",
          ),
        );
        socket.setEncoding("utf8");
        socket.once("data", (data) => {
          resolve(String(data));
          socket.destroy();
        });
        socket.once("error", reject);
      });
      expect(reply).toContain("403 Forbidden");
    } finally {
      await proxy.close();
    }
  });
  it("closes promptly while a client holds an incomplete CONNECT tunnel open", async () => {
    const proxy = await startEgressProxy({
      timeoutMs: 10_000,
      maxRequests: 2,
      maxBytes: 1024,
      deadline: Date.now() + 10_000,
    });
    const endpoint = new URL(proxy.url);
    const socket = connect(Number(endpoint.port), endpoint.hostname);
    await new Promise<void>((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("error", reject);
    });
    socket.write("CONNECT example.com:443 HTTP/1.1\r\nHost:");
    await new Promise((resolve) => setTimeout(resolve, 20));

    let timeout: NodeJS.Timeout | undefined;
    try {
      await expect(
        Promise.race([
          proxy.close().then(() => "closed"),
          new Promise<string>((resolve) => {
            timeout = setTimeout(() => resolve("timed-out"), 1_000);
          }),
        ]),
      ).resolves.toBe("closed");
    } finally {
      if (timeout) clearTimeout(timeout);
    }
    socket.destroy();
  });
  it("rejects non-read HTTP methods and websocket upgrades at the browser proxy", async () => {
    const proxy = await startEgressProxy({
      timeoutMs: 1000,
      maxRequests: 4,
      maxBytes: 1024,
      deadline: Date.now() + 5000,
      minHostIntervalMs: 1,
    });
    try {
      const endpoint = new URL(proxy.url);
      const postStatus = await new Promise<number>((resolve, reject) => {
        const req = request(
          {
            host: endpoint.hostname,
            port: endpoint.port,
            path: "http://example.com/",
            method: "POST",
          },
          (res) => {
            resolve(res.statusCode ?? 0);
            res.resume();
          },
        );
        req.once("error", reject);
        req.end("forbidden");
      });
      expect(postStatus).toBe(405);
      const upgradeStatus = await new Promise<string>((resolve, reject) => {
        const socket = connect(Number(endpoint.port), endpoint.hostname, () =>
          socket.write(
            "GET http://example.com/socket HTTP/1.1\r\nHost: example.com\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n",
          ),
        );
        socket.setEncoding("utf8");
        socket.once("data", (data) => {
          resolve(String(data));
          socket.destroy();
        });
        socket.once("error", reject);
      });
      expect(upgradeStatus).toContain("403 Forbidden");
    } finally {
      await proxy.close();
    }
  });
  it("honors every lower crawler safety limit", () => {
    expect(
      normalizeCrawlOptions({
        maxPages: 2,
        timeoutMs: 1200,
        maxPageBytes: 3000,
        maxTotalBytes: 7000,
        maxRedirects: 1,
        minHostIntervalMs: 1500,
        maxBrowserRequests: 7,
        maxDurationMs: 9000,
      }),
    ).toMatchObject({
      maxPages: 2,
      timeoutMs: 1200,
      maxPageBytes: 3000,
      maxTotalBytes: 7000,
      maxRedirects: 1,
      minHostIntervalMs: 1500,
      maxBrowserRequests: 7,
      maxDurationMs: 9000,
    });
  });
  it("rechecks a redirected destination before following it", () => {
    expect(() =>
      redirectTarget(
        "http://169.254.169.254/latest/meta-data",
        "https://example.test/",
      ),
    ).toThrow(/private|local/i);
  });
  it("accepts only an actual bounded Lighthouse performance score", () => {
    expect(
      lighthousePerformance({ categories: { performance: { score: 0.84 } } }),
    ).toBe(84);
    expect(
      lighthousePerformance({ categories: { performance: { score: null } } }),
    ).toBeNull();
  });
  it("retains source words while excluding scripts and finding contact routes", () => {
    const result = extractPage(
      '<h1>Beispiel &amp; Partner</h1><script>send secrets</script><a href="/kontakt">Kontakt</a>',
      "https://example.ch/",
    );
    expect(result.text).toContain("Beispiel & Partner");
    expect(result.text).not.toContain("send secrets");
    expect(result.links).toContain("https://example.ch/kontakt");
  });
});
