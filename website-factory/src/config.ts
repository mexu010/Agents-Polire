import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  AGENTS,
  validate,
  type AgentName,
  type JsonObject,
} from "./contracts.js";

export interface ModelConfig {
  provider: "openai" | "anthropic";
  model: string;
  reasoning_effort: "low" | "medium";
  max_input_tokens: number;
  max_output_tokens: number;
}

export interface Price {
  provider: "openai" | "anthropic";
  model: string;
  currency: "USD";
  serviceTier: "default";
  inputMicroUsdPerToken: number;
  cacheReadMicroUsdPerToken: number;
  cacheWriteMicroUsdPerToken: number;
  outputMicroUsdPerToken: number;
  maxContextTokens: number;
  maxOutputTokens: number;
  validFrom: string;
  sourceUrl: string;
}

export interface FactoryConfig {
  dataDir: string;
  mode: "fixture" | "live";
  models: Record<AgentName, ModelConfig>;
  budgets: {
    leadMicroUsd: number | null;
    runMicroUsd: number | null;
    dayMicroUsd: number | null;
    spendScopeId: string | null;
    totalMicroUsd: number | null;
    evaluationScopeId?: string | null;
    evaluationMicroUsd?: number | null;
  };
  escalation: { enabled: boolean };
  campaign: JsonObject;
  offer: JsonObject;
  agency: JsonObject | null;
  autoGenerate: boolean;
  research: {
    enabled: boolean;
    maxSteps: number;
    maxQueries: number;
    maxResults: number;
    maxPages: number;
    queryCostMicroUsd: number | null;
  };
  prices: Record<string, Price>;
  limits: {
    maxDispatches: number;
    maxTransientRetries: number;
    maxOutputRepairs: number;
    maxUpgrades: number;
    maxSiteRepairs: number;
    modelTimeoutMs: number;
  };
  crawler: {
    parallelLeads: number;
    requestsPerHost: number;
    minHostIntervalMs: number;
    maxHtmlPagesPerLead: number;
    maxRedirects: number;
    requestTimeoutMs: number;
    maxPageBytes: number;
    maxCrawlBytesPerLead: number;
    maxBrowserRequestsPerLead: number;
    maxCrawlDurationMs: number;
  };
  preview: {
    bindHost: string;
    externalEnabled: boolean;
    submissions: false;
    tracking: false;
    noindex: true;
  };
}

const officialPriceDate = "2026-09-11";
const openAiPrice = (
  model: string,
  input: number,
  cached: number,
  output: number,
): Price => ({
  provider: "openai",
  model,
  currency: "USD",
  serviceTier: "default",
  inputMicroUsdPerToken: input,
  cacheReadMicroUsdPerToken: cached,
  cacheWriteMicroUsdPerToken: input * 1.25,
  outputMicroUsdPerToken: output,
  maxContextTokens: 1_050_000,
  maxOutputTokens: 128_000,
  validFrom: officialPriceDate,
  sourceUrl: `https://developers.openai.com/api/docs/models/${model}`,
});

export function defaultConfig(): FactoryConfig {
  return deepFreeze({
    dataDir: resolve("data"),
    mode: "fixture",
    models: {
      scout: {
        provider: "openai",
        model: "gpt-5.6-luna",
        reasoning_effort: "low",
        max_input_tokens: 24_000,
        max_output_tokens: 6_000,
      },
      audit: {
        provider: "openai",
        model: "gpt-5.6-terra",
        reasoning_effort: "low",
        max_input_tokens: 40_000,
        max_output_tokens: 8_000,
      },
      qualifier: {
        provider: "openai",
        model: "gpt-5.6-luna",
        reasoning_effort: "low",
        max_input_tokens: 18_000,
        max_output_tokens: 4_000,
      },
      strategist: {
        provider: "openai",
        model: "gpt-5.6-terra",
        reasoning_effort: "medium",
        max_input_tokens: 30_000,
        max_output_tokens: 12_000,
      },
      builder: {
        provider: "openai",
        model: "gpt-5.6-luna",
        reasoning_effort: "low",
        max_input_tokens: 36_000,
        max_output_tokens: 16_000,
      },
      qa: {
        provider: "openai",
        model: "gpt-5.6-terra",
        reasoning_effort: "medium",
        max_input_tokens: 48_000,
        max_output_tokens: 8_000,
      },
      sales: {
        provider: "openai",
        model: "gpt-5.6-luna",
        reasoning_effort: "low",
        max_input_tokens: 12_000,
        max_output_tokens: 2_000,
      },
    },
    budgets: {
      leadMicroUsd: null,
      runMicroUsd: null,
      dayMicroUsd: null,
      spendScopeId: null,
      totalMicroUsd: null,
      evaluationScopeId: null,
      evaluationMicroUsd: null,
    },
    escalation: { enabled: false },
    campaign: {
      country: "CH",
      regions: [],
      industries: [],
      adjacent_industries: [],
      locale: "de-CH",
      goals: [],
      exclusion_rules: [],
      max_pages: 5,
    },
    offer: {
      offer_id: "unconfigured",
      services: [],
      unsupported_features: [],
      confirmed_price: null,
    },
    agency: null,
    autoGenerate: false,
    research: {
      enabled: false,
      maxSteps: 6,
      maxQueries: 3,
      maxResults: 5,
      maxPages: 5,
      queryCostMicroUsd: null,
    },
    prices: {
      "openai:gpt-5.6-luna": openAiPrice("gpt-5.6-luna", 0.2, 0.02, 1.2),
      "openai:gpt-5.6-terra": openAiPrice("gpt-5.6-terra", 2, 0.2, 12),
      "openai:gpt-5.6-sol": openAiPrice("gpt-5.6-sol", 4, 0.4, 20),
    },
    limits: {
      maxDispatches: 3,
      maxTransientRetries: 2,
      maxOutputRepairs: 1,
      maxUpgrades: 1,
      maxSiteRepairs: 2,
      modelTimeoutMs: 120_000,
    },
    crawler: {
      parallelLeads: 2,
      requestsPerHost: 1,
      minHostIntervalMs: 1_000,
      maxHtmlPagesPerLead: 6,
      maxRedirects: 3,
      requestTimeoutMs: 15_000,
      maxPageBytes: 2_000_000,
      maxCrawlBytesPerLead: 30_000_000,
      maxBrowserRequestsPerLead: 150,
      maxCrawlDurationMs: 180_000,
    },
    preview: {
      bindHost: "127.0.0.1",
      externalEnabled: false,
      submissions: false,
      tracking: false,
      noindex: true,
    },
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeStrict(
  base: unknown,
  incoming: unknown,
  path = "config",
): unknown {
  if (!isObject(base) || !isObject(incoming)) return incoming;
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(incoming)) {
    if (!(key in base))
      throw new Error(`Unknown configuration key ${path}.${key}`);
    result[key] = mergeStrict(base[key], value, `${path}.${key}`);
  }
  return result;
}

function positiveInteger(
  name: string,
  value: unknown,
): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0)
    throw new Error(`${name} must be a positive integer`);
}

function nonNegativeFinite(
  name: string,
  value: unknown,
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    throw new Error(`${name} must be a non-negative finite number`);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

export function validateConfig(config: FactoryConfig): FactoryConfig {
  if (config.mode !== "fixture" && config.mode !== "live")
    throw new Error("mode must be fixture or live");
  for (const agent of AGENTS) {
    const model = config.models[agent];
    if (
      !model ||
      !["openai", "anthropic"].includes(model.provider) ||
      !model.model
    )
      throw new Error(`models.${agent} is invalid`);
    if (!["low", "medium"].includes(model.reasoning_effort))
      throw new Error(`models.${agent}.reasoning_effort is invalid`);
    positiveInteger(`models.${agent}.max_input_tokens`, model.max_input_tokens);
    positiveInteger(
      `models.${agent}.max_output_tokens`,
      model.max_output_tokens,
    );
    if (
      model.provider === "anthropic" &&
      !config.prices[`anthropic:${model.model}`]
    )
      throw new Error(
        `Anthropic model ${model.model} has no confirmed price profile`,
      );
  }
  for (const [key, value] of Object.entries(config.limits))
    positiveInteger(`limits.${key}`, value);
  const hardLimits: Record<keyof FactoryConfig["limits"], number> = {
    maxDispatches: 3,
    maxTransientRetries: 2,
    maxOutputRepairs: 1,
    maxUpgrades: 1,
    maxSiteRepairs: 2,
    modelTimeoutMs: 120_000,
  };
  for (const [key, cap] of Object.entries(hardLimits) as Array<
    [keyof FactoryConfig["limits"], number]
  >)
    if (config.limits[key] > cap)
      throw new Error(`limits.${key} exceeds hard maximum ${cap}`);
  if (typeof config.autoGenerate !== "boolean")
    throw new Error("autoGenerate must be boolean");
  if (typeof config.research.enabled !== "boolean")
    throw new Error("research.enabled must be boolean");
  for (const [key, cap] of Object.entries({
    maxSteps: 6,
    maxQueries: 5,
    maxResults: 10,
    maxPages: 5,
  })) {
    const value =
      config.research[
        key as "maxSteps" | "maxQueries" | "maxResults" | "maxPages"
      ];
    positiveInteger(`research.${key}`, value);
    if (value > cap)
      throw new Error(`research.${key} exceeds hard maximum ${cap}`);
  }
  if (config.research.queryCostMicroUsd !== null)
    positiveInteger(
      "research.queryCostMicroUsd",
      config.research.queryCostMicroUsd,
    );
  if (
    config.mode === "live" &&
    config.research.enabled &&
    config.research.queryCostMicroUsd === null
  )
    throw new Error("live research requires an explicit search query price");
  if (typeof config.escalation.enabled !== "boolean")
    throw new Error("escalation.enabled must be boolean");
  const crawlerCaps: Record<keyof FactoryConfig["crawler"], number> = {
    parallelLeads: 2,
    requestsPerHost: 1,
    minHostIntervalMs: Number.MAX_SAFE_INTEGER,
    maxHtmlPagesPerLead: 6,
    maxRedirects: 3,
    requestTimeoutMs: 15_000,
    maxPageBytes: 2_000_000,
    maxCrawlBytesPerLead: 30_000_000,
    maxBrowserRequestsPerLead: 150,
    maxCrawlDurationMs: 180_000,
  };
  for (const [key, value] of Object.entries(config.crawler) as Array<
    [keyof FactoryConfig["crawler"], number]
  >) {
    positiveInteger(`crawler.${key}`, value);
    if (key === "minHostIntervalMs" ? value < 1_000 : value > crawlerCaps[key])
      throw new Error(`crawler.${key} violates its hard safety bound`);
  }
  if (!["127.0.0.1", "::1", "localhost"].includes(config.preview.bindHost))
    throw new Error("preview.bindHost must be loopback");
  if (
    config.preview.submissions !== false ||
    config.preview.tracking !== false ||
    config.preview.noindex !== true
  )
    throw new Error("preview safety flags cannot be weakened");
  if (typeof config.preview.externalEnabled !== "boolean")
    throw new Error("preview.externalEnabled must be boolean");
  const evaluationScope = config.budgets.evaluationScopeId;
  const evaluationBudget = config.budgets.evaluationMicroUsd;
  if ((evaluationScope == null) !== (evaluationBudget == null))
    throw new Error(
      "budgets evaluation scope and budget must be configured together",
    );
  if (evaluationScope != null) {
    if (typeof evaluationScope !== "string" || !evaluationScope.trim())
      throw new Error("budgets.evaluationScopeId must be a non-empty string");
    positiveInteger("budgets.evaluationMicroUsd", evaluationBudget);
    if (evaluationScope === config.budgets.spendScopeId)
      throw new Error("budgets.evaluationScopeId must be dedicated");
  }
  validate("Campaign", config.campaign);
  validate("Offer", config.offer);
  if (config.agency !== null) validate("AgencyProfile", config.agency);
  for (const [key, price] of Object.entries(config.prices)) {
    if (price.provider !== "openai" && price.provider !== "anthropic")
      throw new Error(`prices.${key}.provider is invalid`);
    if (
      !price.model ||
      price.currency !== "USD" ||
      price.serviceTier !== "default" ||
      !price.validFrom ||
      !price.sourceUrl
    )
      throw new Error(`prices.${key} is incomplete`);
    nonNegativeFinite(
      `prices.${key}.inputMicroUsdPerToken`,
      price.inputMicroUsdPerToken,
    );
    nonNegativeFinite(
      `prices.${key}.cacheReadMicroUsdPerToken`,
      price.cacheReadMicroUsdPerToken,
    );
    nonNegativeFinite(
      `prices.${key}.cacheWriteMicroUsdPerToken`,
      price.cacheWriteMicroUsdPerToken,
    );
    nonNegativeFinite(
      `prices.${key}.outputMicroUsdPerToken`,
      price.outputMicroUsdPerToken,
    );
    positiveInteger(`prices.${key}.maxContextTokens`, price.maxContextTokens);
    positiveInteger(`prices.${key}.maxOutputTokens`, price.maxOutputTokens);
  }
  for (const [agent, model] of Object.entries(config.models) as Array<
    [AgentName, ModelConfig]
  >) {
    const price = config.prices[`${model.provider}:${model.model}`];
    if (!price) throw new Error(`Missing price profile for models.${agent}`);
    if (model.max_output_tokens > price.maxOutputTokens)
      throw new Error(
        `models.${agent}.max_output_tokens exceeds price capability profile`,
      );
    if (
      model.max_input_tokens + model.max_output_tokens >
      price.maxContextTokens
    )
      throw new Error(`models.${agent} exceeds context capability profile`);
  }
  if (config.mode === "live") {
    for (const key of [
      "leadMicroUsd",
      "runMicroUsd",
      "dayMicroUsd",
      "totalMicroUsd",
    ] as const)
      positiveInteger(`budgets.${key}`, config.budgets[key]);
    if (
      typeof config.budgets.spendScopeId !== "string" ||
      !config.budgets.spendScopeId.trim()
    )
      throw new Error("budgets.spendScopeId is required in live mode");
    for (const model of Object.values(config.models)) {
      const price = config.prices[`${model.provider}:${model.model}`];
      if (
        !price ||
        price.currency !== "USD" ||
        price.serviceTier !== "default" ||
        !price.sourceUrl ||
        !price.validFrom
      ) {
        throw new Error(
          `Missing complete price profile for ${model.provider}:${model.model}`,
        );
      }
    }
  }
  return deepFreeze(config);
}

export function loadConfig(file?: string): FactoryConfig {
  if (!file) return validateConfig(defaultConfig());
  const parsed: unknown = JSON.parse(readFileSync(resolve(file), "utf8"));
  if (!isObject(parsed))
    throw new Error("Configuration root must be an object");
  return validateConfig(mergeStrict(defaultConfig(), parsed) as FactoryConfig);
}
