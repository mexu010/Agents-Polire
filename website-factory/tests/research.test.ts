import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  ResearchLimitError,
  ResearchService,
  ResearchTransportError,
} from "../src/research.js";
import { Store } from "../src/store.js";

function service(
  options: Omit<
    ConstructorParameters<typeof ResearchService>[0],
    "store" | "runId"
  > = {},
) {
  const store = new Store(mkdtempSync(join(tmpdir(), "factory-research-")));
  return {
    store,
    research: new ResearchService({ store, runId: "run-1", ...options }),
  };
}

describe("ResearchService", () => {
  test.each([false, true])(
    "does not resurrect deleted lead research after a delayed search (failure=%s)",
    async (failed) => {
      let release!: () => void, signal!: () => void;
      const pending = new Promise<void>((done) => (release = done)),
        started = new Promise<void>((done) => (signal = done));
      const originalFetch = globalThis.fetch;
      const { store, research } = service({
        apiKey: "fixture-key",
        billing: {
          leadId: "deleted-lead",
          spendScopeId: "test",
          queryCostMicroUsd: 100,
          limits: {
            leadMicroUsd: 1000,
            runMicroUsd: 1000,
            dayMicroUsd: 1000,
            totalMicroUsd: 1000,
          },
        },
      });
      globalThis.fetch = async () => {
        signal();
        await pending;
        if (failed) throw new Error("simulated connection loss");
        return new Response(
          JSON.stringify({
            web: {
              results: [{ url: "https://example.com/", title: "Example" }],
            },
          }),
          { status: 200 },
        );
      };
      try {
        const task = research.discover("salon inspiration").catch(() => null);
        await started;
        store.transaction(() => {
          store.db.prepare("DELETE FROM records").run();
          store.put("tombstones", "deleted-lead", { leadId: "deleted-lead" });
        });
        release();
        await task;
        expect(store.list("research-discovery")).toEqual([]);
        expect(store.list("research-operation")).toEqual([]);
        expect(store.list("research-event")).toEqual([]);
        expect(store.list("research-run")).toEqual([]);
        const budget = store.getBudgetStatus({ runId: "run-1" });
        expect(failed ? budget.uncertainMicroUsd : budget.settledMicroUsd).toBe(
          100,
        );
        await expect(research.discover("another query")).rejects.toThrow(
          /deleted/i,
        );
      } finally {
        globalThis.fetch = originalFetch;
        store.close();
      }
    },
  );
  test("discovers public search results once and resumes from its durable cache", async () => {
    let calls = 0;
    const { store, research } = service({
      searchTransport: async ({ query, limit }) => {
        calls += 1;
        expect(query).toBe("Swiss bakeries");
        expect(limit).toBe(2);
        return [
          {
            url: "https://example.com/about",
            title: "Example",
            snippet: "About us",
          },
          { url: "http://127.0.0.1/private", title: "Private" },
        ];
      },
    });

    const first = await research.discover("Swiss bakeries", { limit: 2 });
    const second = await research.discover(" Swiss bakeries ", { limit: 1 });

    expect(first).toMatchObject({
      cached: false,
      results: [{ url: "https://example.com/about" }],
    });
    expect(second).toMatchObject({
      cached: true,
      results: [{ url: "https://example.com/about" }],
    });
    expect(calls).toBe(1);
    expect(store.get("research-run", "run-1")).toMatchObject({ queryCount: 1 });
    expect(store.list("research-event")).toHaveLength(2);
    store.close();
  });

  test("enforces persisted query limits across service instances", async () => {
    const dir = mkdtempSync(join(tmpdir(), "factory-research-"));
    const firstStore = new Store(dir);
    const first = new ResearchService({
      store: firstStore,
      runId: "run-1",
      maxQueriesPerRun: 1,
      searchTransport: async () => [{ url: "https://example.com/" }],
    });
    await first.discover("one");
    firstStore.close();
    const secondStore = new Store(dir);
    const second = new ResearchService({
      store: secondStore,
      runId: "run-1",
      maxQueriesPerRun: 1,
      searchTransport: async () => [{ url: "https://example.org/" }],
    });
    await expect(second.discover("two")).rejects.toBeInstanceOf(
      ResearchLimitError,
    );
    secondStore.close();
  });

  test("atomically reserves a discovery so concurrent calls send one search", async () => {
    let calls = 0;
    let release!: () => void;
    let signalStarted!: () => void;
    const pending = new Promise<void>((resolve) => (release = resolve));
    const started = new Promise<void>((resolve) => (signalStarted = resolve));
    const { store, research } = service({
      searchTransport: async () => {
        calls += 1;
        signalStarted();
        await pending;
        return [{ url: "https://example.com/" }];
      },
    });
    const first = research.discover("one");
    await started;
    await expect(research.discover("one")).rejects.toThrow(/already started/i);
    release();
    await first;
    expect(calls).toBe(1);
    store.close();
  });

  test("does not repeat a failed discovery on resume and redacts credential errors", async () => {
    const dir = mkdtempSync(join(tmpdir(), "factory-research-"));
    const store = new Store(dir);
    const first = new ResearchService({
      store,
      runId: "run-1",
      apiKey: "secret-token",
      searchTransport: async () => {
        throw new Error("search failed: secret-token");
      },
    });
    await expect(first.discover("one")).rejects.toMatchObject({
      code: "SEARCH_FAILED",
      message: "Search request failed",
    });
    store.close();
    const reopened = new Store(dir);
    const resumed = new ResearchService({
      store: reopened,
      runId: "run-1",
      searchTransport: async () => [{ url: "https://example.com/" }],
    });
    await expect(resumed.discover("one")).rejects.toThrow(/previously failed/i);
    expect(JSON.stringify(reopened.list("research-event"))).not.toContain(
      "secret-token",
    );
    reopened.close();
  });

  test("rejects an invalid live-search billing scope before it creates work", async () => {
    const { store } = service();
    const research = new ResearchService({
      store,
      runId: "run-live",
      apiKey: "configured-key",
      billing: {
        leadId: "",
        spendScopeId: "",
        queryCostMicroUsd: 1,
        limits: {
          runMicroUsd: 1,
          leadMicroUsd: 1,
          dayMicroUsd: 1,
          totalMicroUsd: 0,
        },
      },
    });
    await expect(research.discover("one")).rejects.toThrow(/billing/i);
    expect(store.get("research-run", "run-live")).toBeNull();
    expect(store.list("research-operation")).toHaveLength(0);
    store.close();
  });

  test("requires a total budget for live Brave billing", async () => {
    const { store } = service();
    const research = new ResearchService({
      store,
      runId: "run-total",
      apiKey: "configured-key",
      billing: {
        leadId: "lead-1",
        spendScopeId: "scope-1",
        queryCostMicroUsd: 1,
        limits: { runMicroUsd: 2, leadMicroUsd: 2, dayMicroUsd: 2 },
      },
    });
    await expect(research.discover("one")).rejects.toThrow(/billing/i);
    expect(store.get("research-run", "run-total")).toBeNull();
    store.close();
  });

  test("never exposes a raw fetch transport error", async () => {
    const { store, research } = service({
      fetchTransport: async () => {
        throw new Error("Authorization=source-secret");
      },
    });
    await expect(research.read("https://example.com/")).rejects.toBeInstanceOf(
      ResearchTransportError,
    );
    expect(JSON.stringify(store.list("research-event"))).not.toContain(
      "source-secret",
    );
    store.close();
  });

  test("requires a Brave key before it reserves a paid search", async () => {
    const { store, research } = service();
    await expect(research.discover("one")).rejects.toThrow(
      /BRAVE_SEARCH_API_KEY/,
    );
    expect(store.get("research-run", "run-1")).toBeNull();
    store.close();
  });

  test("reads a public source into bounded grounded evidence without inferring business activity", async () => {
    const { store, research } = service({
      maxSourceChars: 20,
      fetchTransport: async (url) => ({
        url,
        status: 200,
        contentType: "text/html",
        body: "<title>Example</title><p>We bake bread every day.</p><script>secret</script>",
      }),
    });

    const result = await research.read("https://example.com/");

    expect(result.text).toBe("Example We bake brea");
    expect(result.evidence).toMatchObject({
      sourceUrl: "https://example.com/",
      businessStatus: "unknown",
      truncated: true,
    });
    expect(store.get("research-fetch", result.id)).toMatchObject({
      url: "https://example.com/",
    });
    store.close();
  });

  test("refuses private source reads before invoking a transport", async () => {
    const fetchTransport = async () => {
      throw new Error("must not fetch");
    };
    const { store, research } = service({ fetchTransport });
    await expect(research.read("http://127.0.0.1/")).rejects.toThrow(
      /private|local/i,
    );
    store.close();
  });

  test("records a non-successful source response as failed instead of evidence", async () => {
    const { store, research } = service({
      fetchTransport: async (url) => ({ url, status: 404, body: "Not found" }),
    });
    await expect(research.read("https://example.com/")).rejects.toMatchObject({
      code: "FETCH_FAILED",
      message: "Source request failed",
    });
    await expect(research.read("https://example.com/")).rejects.toThrow(
      /previously failed/i,
    );
    expect(store.list("research-fetch")).toHaveLength(0);
    store.close();
  });
});
