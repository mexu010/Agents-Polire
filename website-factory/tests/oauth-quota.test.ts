import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { Store } from "../src/store.js";
import { reserveOAuthCall, oauthQuotaStatus } from "../src/oauth-quota.js";

test("OAuth reservations are durable and shared across connections and runs", () => {
  const dir = mkdtempSync(join(tmpdir(), "oauth-quota-"));
  const a = new Store(dir),
    b = new Store(dir);
  const limits = {
    scopeId: "test",
    maxCallsPerRun: 1,
    maxCallsPerDay: 2,
    maxCallsTotal: 2,
  };
  const take = (store: Store, runId: string, attemptId: string) =>
    reserveOAuthCall(store, limits, { runId, attemptId });
  take(a, "one", "a");
  expect(() => take(b, "one", "b")).toThrow(/run/);
  take(b, "two", "c");
  expect(() => take(a, "three", "d")).toThrow(/total|day/);
  expect(oauthQuotaStatus(a, "test").calls).toBe(2);
  a.close();
  b.close();
  const reopened = new Store(dir);
  expect(() => take(reopened, "three", "e")).toThrow();
  reopened.close();
});

test("OAuth quotas cannot silently increase on restart", () => {
  const store = new Store(mkdtempSync(join(tmpdir(), "oauth-quota-")));
  const limits = {
    scopeId: "test",
    maxCallsPerRun: 1,
    maxCallsPerDay: 1,
    maxCallsTotal: 1,
  };
  reserveOAuthCall(store, limits, { runId: "one", attemptId: "a" });
  expect(() =>
    reserveOAuthCall(
      store,
      { ...limits, maxCallsTotal: 99, maxCallsPerDay: 99, maxCallsPerRun: 99 },
      { runId: "two", attemptId: "b" },
    ),
  ).toThrow();
  store.close();
});
