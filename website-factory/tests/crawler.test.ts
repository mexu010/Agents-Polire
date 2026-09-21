import { connect } from "node:net";
import { request } from "node:http";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  publicUrl,
  isPublicAddress,
  extractPage,
  lighthousePerformance,
  normalizeCrawlOptions,
  navigateForCapture,
  pinnedLookup,
  redirectTarget,
  resolvePublicHost,
  runLighthouseWorker,
  startEgressProxy,
  prioritizeCrawlLinks,
} from "../src/crawler.js";

describe("external network boundary", () => {
  it("uses the small page allowance for contact evidence before general service pages", () => {
    const links = [
      "https://company.ch/leistungen",
      "https://company.ch/team",
      "https://company.ch/kontakt",
      "https://company.ch/impressum",
    ];
    expect(prioritizeCrawlLinks(links)).toEqual([
      links[2],
      links[3],
      links[1],
      links[0],
    ]);
    expect(links[0]).toBe("https://company.ch/leistungen");
  });
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

  it("extracts readable Swiss names from HTML entities without losing case", () => {
    const result = extractPage(
      '<h1>Blumeng&auml;rtnerei Wismer AG</h1><p>&Auml; &Ouml; &Uuml; &eacute; &#XFC; &#1114112;</p><a href="/gr&uuml;n">Angebot</a>',
      "https://example.ch/",
    );
    expect(result.text).toContain("Blumengärtnerei Wismer AG");
    expect(result.text).toContain("Ä Ö Ü é ü �");
    expect(result.links).toContain("https://example.ch/gr%C3%BCn");
  });

  it("keeps a loaded document usable when network idle times out", async () => {
    const navigationOptions: Array<Record<string, unknown>> = [];
    const page = {
      goto: async (_url: string, options: Record<string, unknown>) => {
        navigationOptions.push(options);
      },
      waitForLoadState: async () => {
        throw new Error("network idle timeout");
      },
      url: () => "https://example.com/",
      evaluate: async () => "complete",
    };

    const result = await navigateForCapture(
      page as never,
      "https://example.com/",
      1_000,
    );

    expect(navigationOptions).toEqual([
      { waitUntil: "domcontentloaded", timeout: 1_000 },
    ]);
    expect(result).toEqual({
      domContentLoadedTimedOut: false,
      networkIdleTimedOut: true,
    });
  });

  it("kills a Lighthouse worker that exceeds its deadline", async () => {
    const outputDir = await mkdtemp(
      path.join(tmpdir(), "crawler-worker-test-"),
    );
    const started = Date.now();

    await expect(
      runLighthouseWorker({
        website: "https://example.com/hang",
        debuggingPort: 9,
        timeoutMs: 50,
        reportPath: path.join(outputDir, "report.json"),
        workerPath: path.join(
          import.meta.dirname,
          "crawler-lighthouse-worker-fixture.mjs",
        ),
      }),
    ).rejects.toThrow(/timed out/i);
    expect(Date.now() - started).toBeLessThan(1_000);
  });
});
