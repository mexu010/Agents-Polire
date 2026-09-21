import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, vi } from "vitest";
import { defaultConfig } from "../src/config.js";
import { ModelProvider } from "../src/provider.js";
import { Store } from "../src/store.js";
import {
  fixtureInput,
  fixtureOutput,
  buildAgentInput,
} from "../src/fixtures.js";

function setup() {
  const config = structuredClone(defaultConfig());
  config.mode = "live";
  config.dataDir = mkdtempSync(join(tmpdir(), "oauth-provider-"));
  const store = new Store(config.dataDir);
  const input = buildAgentInput("scout", fixtureInput());
  input.images = [];
  const output = fixtureOutput("scout", input);
  const oauth = {
    check: vi.fn(async () => ({
      authMode: "chatgpt" as const,
      models: ["gpt-5.6-luna", "gpt-5.6-terra"],
    })),
    run: vi.fn(async () => ({
      text: JSON.stringify(output),
      model: "gpt-5.6-luna",
      usage: {
        inputTokens: 100,
        cachedInputTokens: 20,
        outputTokens: 50,
        reasoningTokens: 10,
        totalTokens: 150,
      },
    })),
  };
  return {
    config,
    store,
    input,
    output,
    oauth,
    args: {
      agent: "scout" as const,
      input,
      runId: "run",
      leadId: "lead",
      stepId: "step",
    },
  };
}
test("default OAuth uses managed login, keeps actual usage and no invented USD bill", async () => {
  const s = setup();
  const api = { responses: { create: vi.fn() } };
  const provider = new ModelProvider(s.config, s.store, {
    oauth: s.oauth,
    openai: api,
  });
  expect(await provider.invoke(s.args)).toEqual(s.output);
  expect(api.responses.create).not.toHaveBeenCalled();
  const rows = s.store.db
    .prepare("SELECT * FROM agent_attempts")
    .all() as any[];
  expect(rows[0]).toMatchObject({
    provider: "codex_oauth",
    actual_cost_micro_usd: null,
    billing_status: "subscription",
    state: "succeeded",
  });
  expect(JSON.parse(rows[0].normalized_usage_json)).toMatchObject({
    inputTokens: 100,
    outputTokens: 50,
    reasoningTokens: 10,
    totalTokens: 150,
    cacheReadTokens: 20,
    cacheWriteTokens: null,
  });
  expect(
    s.store.db.prepare("SELECT * FROM budget_reservations").all(),
  ).toHaveLength(0);
  s.store.close();
});
test("OAuth doctor checks every configured model without inference", async () => {
  const s = setup();
  const p = new ModelProvider(s.config, s.store, { oauth: s.oauth });
  expect(await p.doctor()).toMatchObject({
    ok: true,
    authentication: "chatgpt_oauth",
    inferenceCalls: 0,
  });
  expect(s.oauth.run).not.toHaveBeenCalled();
  expect(s.oauth.check).toHaveBeenCalled();
  s.store.close();
});
test("a lost OAuth result remains consumed and cannot be silently redispatched", async () => {
  const s = setup();
  s.oauth.run.mockRejectedValue(new Error("secret transport details"));
  const p = new ModelProvider(s.config, s.store, { oauth: s.oauth });
  await expect(p.invoke(s.args)).rejects.toThrow(
    /OAuth request did not complete/,
  );
  await expect(p.invoke(s.args)).rejects.toThrow(/unresolved/);
  expect(s.oauth.run).toHaveBeenCalledTimes(1);
  expect(
    JSON.stringify(s.store.db.prepare("SELECT * FROM agent_attempts").all()),
  ).not.toContain("secret transport");
  s.store.close();
});
test("a changed login or unavailable model never falls back to API credentials", async () => {
  const s = setup();
  s.oauth.check.mockRejectedValue(new Error("Login required"));
  const api = { responses: { create: vi.fn() } };
  const p = new ModelProvider(s.config, s.store, {
    oauth: s.oauth,
    openai: api,
  });
  await expect(p.invoke(s.args)).rejects.toThrow();
  expect(api.responses.create).not.toHaveBeenCalled();
  expect(s.oauth.run).not.toHaveBeenCalled();
  s.store.close();
});

test("OAuth schema repair consumes the same durable quota and stops after one repair", async () => {
  const s = setup();
  s.oauth.run.mockResolvedValue({
    text: "{}",
    model: "gpt-5.6-luna",
    usage: {
      inputTokens: 10,
      cachedInputTokens: 0,
      outputTokens: 5,
      reasoningTokens: 0,
      totalTokens: 15,
    },
  });
  const p = new ModelProvider(s.config, s.store, { oauth: s.oauth });
  await expect(p.invoke(s.args)).rejects.toThrow(/schema validation/);
  expect(s.oauth.run).toHaveBeenCalledTimes(2);
  expect(s.store.countAttempts("step", "output_repair")).toBe(1);
  await expect(
    p.invoke({ ...s.args, repair: { reason: "SCHEMA_ERROR" } }),
  ).rejects.toThrow(/repair allowance/);
  expect(s.oauth.run).toHaveBeenCalledTimes(2);
  s.store.close();
});

test("oversized OAuth output is rejected while preserving actual usage", async () => {
  const s = setup();
  s.oauth.run.mockResolvedValue({
    text: JSON.stringify(s.output),
    model: "gpt-5.6-luna",
    usage: {
      inputTokens: 100,
      cachedInputTokens: 20,
      outputTokens: 9000,
      reasoningTokens: 1000,
      totalTokens: 9100,
    },
  });
  await expect(
    new ModelProvider(s.config, s.store, { oauth: s.oauth }).invoke(s.args),
  ).rejects.toThrow(/response limit/);
  const row = s.store.db
    .prepare(
      "SELECT normalized_usage_json,billing_status,state FROM agent_attempts",
    )
    .get() as any;
  expect(row).toMatchObject({
    state: "failed",
    billing_status: "subscription",
  });
  expect(JSON.parse(row.normalized_usage_json).totalTokens).toBe(9100);
  s.store.close();
});

test("OAuth research uses the configured Scout model and reuses a bound decision", async () => {
  const s = setup();
  const decision = {
    action: "stop",
    query: null,
    url: null,
    candidate_urls: [],
    reason: "No sources",
  };
  s.oauth.run.mockResolvedValue({
    text: JSON.stringify(decision),
    model: "gpt-5.6-luna",
    usage: {
      inputTokens: 100,
      cachedInputTokens: 0,
      outputTokens: 20,
      reasoningTokens: 0,
      totalTokens: 120,
    },
  });
  const p = new ModelProvider(s.config, s.store, { oauth: s.oauth });
  const args = {
    input: { objective: "test" },
    runId: "research",
    leadId: "research",
    stepId: "research-step",
  };
  expect(await p.decideResearch(args)).toEqual(decision);
  expect(await p.decideResearch(args)).toEqual(decision);
  expect(s.oauth.run).toHaveBeenCalledTimes(1);
  await expect(
    p.decideResearch({ ...args, input: { objective: "changed" } }),
  ).rejects.toThrow(/does not match/);
  s.store.close();
});
