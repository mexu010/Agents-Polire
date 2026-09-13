import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { BudgetExceededError, Store } from "../src/store.js";

function newDataDir(): string {
  return mkdtempSync(join(tmpdir(), "factory-store-"));
}

describe("Store generic records", () => {
  test("persists JSON records across Store instances", () => {
    const dir = newDataDir();
    const first = new Store(dir);
    first.put("briefs", "brief-1", { revision: 1, title: "Test" });
    first.close();

    const second = new Store(dir);
    expect(second.get("briefs", "brief-1")).toEqual({
      id: "brief-1",
      revision: 1,
      title: "Test",
    });
    expect(second.list("briefs")).toEqual([
      { id: "brief-1", revision: 1, title: "Test" },
    ]);
    second.close();
  });
});

describe("Store budget ledger", () => {
  test("two competing reservations cannot spend the same available budget", async () => {
    const dir = newDataDir();
    const a = new Store(dir);
    const b = new Store(dir);
    const request = {
      runId: "run-1",
      leadId: "lead-1",
      dayKey: "2026-09-11",
      amountMicroUsd: 700,
      limits: { runMicroUsd: 1_000, leadMicroUsd: 1_000, dayMicroUsd: 1_000 },
    } as const;

    const outcomes = await Promise.allSettled([
      Promise.resolve().then(() =>
        a.reserveBudget({ ...request, reservationId: "r-a", attemptId: "a-a" }),
      ),
      Promise.resolve().then(() =>
        b.reserveBudget({ ...request, reservationId: "r-b", attemptId: "a-b" }),
      ),
    ]);

    expect(
      outcomes.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const rejection = outcomes.find((result) => result.status === "rejected");
    expect(rejection).toMatchObject({
      reason: expect.any(BudgetExceededError),
    });
    a.close();
    b.close();
  });

  test("a dispatched timeout stays uncertain and continues to consume budget after reopen", () => {
    const dir = newDataDir();
    const store = new Store(dir);
    store.reserveBudget({
      reservationId: "reservation-1",
      attemptId: "attempt-1",
      runId: "run-1",
      leadId: "lead-1",
      dayKey: "2026-09-11",
      amountMicroUsd: 800,
      limits: { runMicroUsd: 1_000, leadMicroUsd: 1_000, dayMicroUsd: 1_000 },
    });
    store.markDispatched("reservation-1");
    store.markBudgetUncertain("reservation-1", "timeout");
    store.close();

    const reopened = new Store(dir);
    expect(reopened.getBudgetStatus({ runId: "run-1" })).toMatchObject({
      uncertainMicroUsd: 800,
      availableMicroUsd: 200,
    });
    expect(() =>
      reopened.reserveBudget({
        reservationId: "reservation-2",
        attemptId: "attempt-2",
        runId: "run-1",
        leadId: "lead-1",
        dayKey: "2026-09-11",
        amountMicroUsd: 300,
        limits: { runMicroUsd: 1_000, leadMicroUsd: 1_000, dayMicroUsd: 1_000 },
      }),
    ).toThrow(BudgetExceededError);
    reopened.close();
  });

  test("settles known usage, releases unused reserve, and blocks an account after an overrun", () => {
    const store = new Store(newDataDir());
    store.reserveBudget({
      reservationId: "reservation-1",
      attemptId: "attempt-1",
      runId: "run-1",
      leadId: "lead-1",
      dayKey: "2026-09-11",
      amountMicroUsd: 800,
      limits: { runMicroUsd: 1_000, leadMicroUsd: 1_000, dayMicroUsd: 1_000 },
    });
    store.markDispatched("reservation-1");
    store.settleBudget("reservation-1", {
      actualCostMicroUsd: 400,
      rawUsage: { input_tokens: 10 },
    });
    expect(store.getBudgetStatus({ runId: "run-1" })).toMatchObject({
      settledMicroUsd: 400,
      reservedMicroUsd: 0,
      availableMicroUsd: 600,
      blocked: false,
    });

    store.reserveBudget({
      reservationId: "reservation-2",
      attemptId: "attempt-2",
      runId: "run-2",
      leadId: "lead-2",
      dayKey: "2026-09-12",
      amountMicroUsd: 500,
      limits: { runMicroUsd: 600, leadMicroUsd: 600, dayMicroUsd: 600 },
    });
    store.markDispatched("reservation-2");
    store.settleBudget("reservation-2", {
      actualCostMicroUsd: 700,
      rawUsage: { output_tokens: 10 },
    });
    expect(store.getBudgetStatus({ runId: "run-2" })).toMatchObject({
      settledMicroUsd: 700,
      availableMicroUsd: -100,
      blocked: true,
    });
    store.close();
  });

  test("dispatch counters remain persisted across retries and resume", () => {
    const dir = newDataDir();
    const store = new Store(dir);
    store.createAttempt({
      attemptId: "a1",
      stepId: "step-1",
      runId: "run-1",
      leadId: "lead-1",
      agent: "scout",
      model: "gpt-5.6-luna",
      kind: "initial",
    });
    store.updateAttempt("a1", { state: "dispatched" });
    store.createAttempt({
      attemptId: "a2",
      stepId: "step-1",
      runId: "run-1",
      leadId: "lead-1",
      agent: "scout",
      model: "gpt-5.6-luna",
      kind: "transient_retry",
    });
    store.updateAttempt("a2", { state: "dispatched" });
    expect(store.countDispatches("step-1")).toBe(2);
    store.close();

    const reopened = new Store(dir);
    expect(reopened.countDispatches("step-1")).toBe(2);
    expect(reopened.getAttempt("a2")).toMatchObject({
      kind: "transient_retry",
      state: "dispatched",
    });
    reopened.close();
  });

  test("a durable spend scope caps doctor and lead costs across runs and days", () => {
    const dir = newDataDir();
    const store = new Store(dir);
    const limits = {
      runMicroUsd: 2_000,
      leadMicroUsd: 2_000,
      dayMicroUsd: 2_000,
      totalMicroUsd: 1_000,
    };
    store.reserveBudget({
      reservationId: "doctor-r",
      attemptId: "doctor-a",
      runId: "doctor",
      leadId: "system",
      dayKey: "2026-09-11",
      spendScopeId: "pilot-1",
      amountMicroUsd: 600,
      limits,
    });
    store.markDispatched("doctor-r");
    store.settleBudget("doctor-r", { actualCostMicroUsd: 600, rawUsage: {} });
    expect(() =>
      store.reserveBudget({
        reservationId: "lead-r",
        attemptId: "lead-a",
        runId: "run-next",
        leadId: "lead-next",
        dayKey: "2026-09-12",
        spendScopeId: "pilot-1",
        amountMicroUsd: 500,
        limits,
      }),
    ).toThrow(BudgetExceededError);
    expect(store.getBudgetStatus({ spendScopeId: "pilot-1" })).toMatchObject({
      settledMicroUsd: 600,
      availableMicroUsd: 400,
    });
    store.close();
  });
});
