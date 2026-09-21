import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { defaultConfig, loadConfig } from "../src/config.js";

describe("factory configuration", () => {
  test("accepts an explicit fast crawl profile without enabling a hidden performance score", () => {
    const dir = mkdtempSync(join(tmpdir(), "factory-fast-config-"));
    const file = join(dir, "config.json");
    writeFileSync(file, JSON.stringify({ crawler: { lighthouse: false } }));
    expect(loadConfig(file).crawler.lighthouse).toBe(false);
    writeFileSync(file, JSON.stringify({ crawler: { lighthouse: "false" } }));
    expect(() => loadConfig(file)).toThrow(/lighthouse/);
  });
  test("defaults to a cost-free fixture configuration with the exact runtime model map", () => {
    const config = defaultConfig();

    expect(config.mode).toBe("fixture");
    expect(config.budgets).toEqual({
      leadMicroUsd: null,
      runMicroUsd: null,
      dayMicroUsd: null,
      spendScopeId: null,
      totalMicroUsd: null,
      evaluationScopeId: null,
      evaluationMicroUsd: null,
    });
    expect(config.escalation.enabled).toBe(false);
    expect(config.models).toMatchObject({
      scout: {
        provider: "openai",
        model: "gpt-5.6-luna",
        reasoning_effort: "low",
      },
      audit: {
        provider: "openai",
        model: "gpt-5.6-terra",
        reasoning_effort: "low",
      },
      strategist: {
        provider: "openai",
        model: "gpt-5.6-terra",
        reasoning_effort: "medium",
      },
      qa: {
        provider: "openai",
        model: "gpt-5.6-terra",
        reasoning_effort: "medium",
      },
      sales: {
        provider: "openai",
        model: "gpt-5.6-luna",
        reasoning_effort: "low",
      },
    });
    expect(config.dataDir).toMatch(/[\\/]data$/);
    expect(config.campaign).toMatchObject({
      locale: "de-CH",
      goals: [],
      exclusion_rules: [],
      max_pages: 5,
    });
    expect(config.offer).toEqual({
      offer_id: "unconfigured",
      services: [],
      unsupported_features: [],
      confirmed_price: null,
    });
    expect(Object.isFrozen(config.models.scout)).toBe(true);
  });

  test("rejects live mode unless every budget is a positive integer", () => {
    const dir = mkdtempSync(join(tmpdir(), "factory-config-"));
    const file = join(dir, "config.json");
    writeFileSync(
      file,
      JSON.stringify({
        mode: "live",
        authentication: "api_key",
        budgets: {
          leadMicroUsd: 2_000_000,
          runMicroUsd: 2_000_000,
          dayMicroUsd: null,
          spendScopeId: "pilot-1",
          totalMicroUsd: 2_000_000,
        },
      }),
    );

    expect(() => loadConfig(file)).toThrow(/dayMicroUsd/);
  });

  test("rejects unknown configuration keys before a paid request can use them", () => {
    const dir = mkdtempSync(join(tmpdir(), "factory-config-"));
    const file = join(dir, "config.json");
    writeFileSync(file, JSON.stringify({ mystery: true }));

    expect(() => loadConfig(file)).toThrow(/mystery/);
  });

  test("accepts complete campaign and offer contracts but rejects invalid prices", () => {
    const dir = mkdtempSync(join(tmpdir(), "factory-config-"));
    const validFile = join(dir, "valid.json");
    writeFileSync(
      validFile,
      JSON.stringify({
        campaign: {
          country: "CH",
          regions: ["Zürich"],
          industries: ["Sanitär"],
          adjacent_industries: [],
          locale: "de-CH",
          goals: ["Anfragen"],
          exclusion_rules: [],
          max_pages: 3,
        },
        offer: {
          offer_id: "websites",
          services: ["Websites"],
          unsupported_features: ["Shop"],
          confirmed_price: null,
        },
      }),
    );
    expect(loadConfig(validFile).offer.offer_id).toBe("websites");

    const invalidFile = join(dir, "invalid.json");
    writeFileSync(
      invalidFile,
      JSON.stringify({
        prices: { "openai:gpt-5.6-luna": { inputMicroUsdPerToken: -1 } },
      }),
    );
    expect(() => loadConfig(invalidFile)).toThrow(/inputMicroUsdPerToken/);
  });

  test("rejects settings that weaken hard runtime safety limits", () => {
    const dir = mkdtempSync(join(tmpdir(), "factory-config-"));
    for (const [name, patch, pattern] of [
      ["dispatch.json", { limits: { maxDispatches: 4 } }, /maxDispatches/],
      ["preview.json", { preview: { bindHost: "0.0.0.0" } }, /bindHost/],
      [
        "model.json",
        { models: { scout: { max_output_tokens: 200_000 } } },
        /max_output_tokens/,
      ],
    ] as const) {
      const file = join(dir, name);
      writeFileSync(file, JSON.stringify(patch));
      expect(() => loadConfig(file)).toThrow(pattern);
    }
  });

  test("requires evaluation budget fields as a positive dedicated pair", () => {
    const dir = mkdtempSync(join(tmpdir(), "factory-config-eval-"));
    const file = join(dir, "config.json");
    writeFileSync(
      file,
      JSON.stringify({ budgets: { evaluationScopeId: "eval" } }),
    );
    expect(() => loadConfig(file)).toThrow(/configured together/i);
    writeFileSync(
      file,
      JSON.stringify({
        budgets: {
          evaluationScopeId: "same",
          evaluationMicroUsd: 1,
          spendScopeId: "same",
        },
      }),
    );
    expect(() => loadConfig(file)).toThrow(/dedicated/i);
  });
});
