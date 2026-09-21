import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { describe, expect, test } from "vitest";
import { defaultConfig, type FactoryConfig } from "../src/config.js";
import { processAgentOutput } from "../src/agents.js";
import type { JsonObject } from "../src/contracts.js";
import {
  buildAgentInput,
  fixtureInput,
  fixtureOutput,
} from "../src/fixtures.js";
import {
  ModelProvider,
  ProviderError,
  VISION_INPUT_TOKEN_BOUND,
  calculateCost,
  calculateReservation,
} from "../src/provider.js";
import { Store } from "../src/store.js";

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const name = Buffer.from(type);
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([head, name, data, tail]);
}
function screenshotPng(): Buffer {
  const width = 400,
    height = 400,
    raw = Buffer.alloc((width * 4 + 1) * height);
  let state = 123456789;
  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1);
    for (let x = 0; x < width * 4; x++) {
      state = (1664525 * state + 1013904223) >>> 0;
      raw[row + 1 + x] = state >>> 24;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function liveConfig(): FactoryConfig {
  const config = structuredClone(defaultConfig());
  config.mode = "live";
  config.authentication = "api_key";
  config.budgets = {
    leadMicroUsd: 1_000_000,
    runMicroUsd: 1_000_000,
    dayMicroUsd: 1_000_000,
    spendScopeId: "test-scope",
    totalMicroUsd: 1_000_000,
  };
  return config;
}

test("vision token ceiling records its official source, date, and exact model scope", () => {
  expect(VISION_INPUT_TOKEN_BOUND).toMatchObject({
    sourceUrl: "https://developers.openai.com/api/docs/guides/images-vision",
    verifiedAt: "2026-09-11",
    models: ["gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol"],
    high: { maxPatches: 2_500, maxTokens: 3_000 },
  });
});

test("research decisions use the fixed strict schema and Scout budget accounting", async () => {
  const config = liveConfig();
  const store = new Store(
    (config.dataDir = mkdtempSync(
      join(tmpdir(), "factory-research-provider-"),
    )),
  );
  let request: any;
  const provider = new ModelProvider(config, store, {
    openai: {
      responses: {
        async create(body: any) {
          request = body;
          return completed({
            action: "search",
            query: "electricians zurich",
            url: null,
            candidate_urls: [],
            reason: "Find candidates",
          });
        },
      },
    },
  });

  await expect(
    provider.decideResearch({
      runId: "research-run",
      leadId: "research-lead",
      stepId: "research-run:decision:0",
      input: { objective: "Find candidates", observations: [] },
    }),
  ).resolves.toMatchObject({ action: "search" });
  await expect(
    provider.decideResearch({
      runId: "research-run",
      leadId: "research-lead",
      stepId: "research-run:decision:0",
      input: { objective: "Find candidates", observations: [] },
    }),
  ).resolves.toMatchObject({ action: "search" });
  await expect(
    provider.decideResearch({
      runId: "research-run",
      leadId: "research-lead",
      stepId: "research-run:decision:0",
      input: { objective: "Changed objective", observations: [] },
    }),
  ).rejects.toMatchObject({ code: "CACHE_INPUT_MISMATCH" });
  expect(request).toMatchObject({
    model: "gpt-5.6-luna",
    reasoning: { effort: "low" },
    text: {
      format: {
        type: "json_schema",
        name: "ResearchDecision",
        strict: true,
        schema: { additionalProperties: false },
      },
    },
  });
  expect(store.getBudgetStatus({ runId: "research-run" }).settledMicroUsd).toBe(
    529,
  );
  expect(store.countAttempts("research-run:decision:0")).toBe(1);
  store.close();
});

test("research decisions reject semantically invalid combinations after schema output", async () => {
  const config = liveConfig();
  const store = new Store(
    (config.dataDir = mkdtempSync(join(tmpdir(), "factory-research-invalid-"))),
  );
  const provider = new ModelProvider(config, store, {
    openai: {
      responses: {
        async create() {
          return completed({
            action: "finish",
            query: "must be null for finish",
            url: null,
            candidate_urls: [],
            reason: "invalid",
          });
        },
      },
    },
  });
  await expect(
    provider.decideResearch({
      runId: "invalid-run",
      leadId: "invalid-lead",
      stepId: "invalid-run:decision:0",
      input: { objective: "Find candidates", observations: [] },
    }),
  ).rejects.toMatchObject({ code: "SCHEMA_ERROR" });
  store.close();
});

test("accepts complete orchestrator inputs, reachable schemas, and a real screenshot within every configured bound", async () => {
  const config = liveConfig();
  const store = new Store(
    (config.dataDir = mkdtempSync(
      join(tmpdir(), "factory-provider-e2e-bound-"),
    )),
  );
  const imagePath = join(config.dataDir, "screen.png");
  const png = screenshotPng();
  writeFileSync(imagePath, png);
  expect(png.length).toBeGreaterThan(200_000);
  const root = fixtureInput();
  root.images = [
    {
      ...root.images[0],
      attachment_ref: imagePath,
      sha256: createHash("sha256").update(png).digest("hex"),
    },
  ];
  const scoutInput = buildAgentInput("scout", root);
  const profile = processAgentOutput(
    "scout",
    fixtureOutput("scout", scoutInput),
    scoutInput,
  );
  const auditInput = buildAgentInput("audit", { ...root, profile });
  const audit = processAgentOutput(
    "audit",
    fixtureOutput("audit", auditInput),
    auditInput,
  );
  const qualifierInput = buildAgentInput("qualifier", {
    ...root,
    profile,
    audit,
  });
  const qualification = processAgentOutput(
    "qualifier",
    fixtureOutput("qualifier", qualifierInput),
    qualifierInput,
  );
  const strategistInput = buildAgentInput("strategist", {
    ...root,
    profile,
    audit,
    qualification,
  });
  const brief = processAgentOutput(
    "strategist",
    fixtureOutput("strategist", strategistInput),
    strategistInput,
  );
  const builderInput = buildAgentInput("builder", { ...root, profile, brief });
  const siteSpec = processAgentOutput(
    "builder",
    fixtureOutput("builder", builderInput),
    builderInput,
  );
  const browser = fixtureOutput("browser", { ...root, siteSpec });
  browser.images[0].path = imagePath;
  browser.images[0].sha256 = createHash("sha256").update(png).digest("hex");
  const qaInput = buildAgentInput("qa", {
    ...root,
    profile,
    audit,
    brief,
    siteSpec,
    browser,
  });
  const salesInput = fixtureOutput("sales-input", { ...root, profile });
  const inputs = {
    scout: scoutInput,
    audit: auditInput,
    qualifier: qualifierInput,
    strategist: strategistInput,
    builder: builderInput,
    qa: qaInput,
    sales: salesInput,
  } as const;
  const nameToAgent: Record<string, keyof typeof inputs> = {
    ScoutOutput: "scout",
    AuditOutput: "audit",
    QualifierOutput: "qualifier",
    StrategistOutput: "strategist",
    BuilderOutput: "builder",
    QAOutput: "qa",
    SalesOutput: "sales",
  };
  const openai = {
    responses: {
      create: async (body: any) => {
        const agent = nameToAgent[body.text.format.name];
        const input = JSON.parse(body.input[0].content[0].text);
        return {
          id: `e2e-${agent}`,
          model: body.model,
          status: "completed",
          service_tier: "default",
          output_text: JSON.stringify(fixtureOutput(agent, input)),
          usage: {
            input_tokens: 10,
            input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 },
            output_tokens: 10,
            output_tokens_details: { reasoning_tokens: 0 },
            total_tokens: 20,
          },
        };
      },
    },
  };
  const provider = new ModelProvider(config, store, { openai });
  for (const [agent, input] of Object.entries(inputs) as Array<
    [keyof typeof inputs, JsonObject]
  >) {
    const images = (input.images ?? []).map((item: any) => ({
      path: item.attachment_ref,
      evidence_id: item.evidence_id,
      sha256: item.sha256,
    }));
    await expect(
      provider.invoke({
        agent,
        input,
        images,
        runId: `run-${agent}`,
        leadId: `lead-${agent}`,
        stepId: `bound-${agent}`,
      }),
    ).resolves.toBeTruthy();
  }
  store.close();
});

function completed(
  output: unknown,
  usage: unknown = {
    input_tokens: 1_000,
    input_tokens_details: { cached_tokens: 200, cache_write_tokens: 100 },
    output_tokens: 300,
    output_tokens_details: { reasoning_tokens: 100 },
    total_tokens: 1_300,
  },
  model = "gpt-5.6-luna",
) {
  return {
    id: "resp-1",
    _request_id: "req-1",
    model,
    service_tier: "default",
    status: "completed",
    output_text: JSON.stringify(output),
    output: [],
    usage,
  };
}

describe("provider accounting", () => {
  test("fixture doctor works without constructing a keyed live client", async () => {
    const previous = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const store = new Store(mkdtempSync(join(tmpdir(), "factory-provider-")));
    try {
      await expect(
        new ModelProvider(defaultConfig(), store).doctor(),
      ).resolves.toMatchObject({ mode: "fixture", ok: true, paid: false });
    } finally {
      if (previous === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previous;
      store.close();
    }
  });

  test("reserves the worst case and does not double-charge reasoning tokens", () => {
    const price = liveConfig().prices["openai:gpt-5.6-luna"];
    expect(
      calculateReservation(
        { max_input_tokens: 24_000, max_output_tokens: 6_000 },
        price,
      ),
    ).toBe(13_200);
    expect(
      calculateCost(
        {
          input_tokens: 1_000,
          input_tokens_details: { cached_tokens: 200, cache_write_tokens: 100 },
          output_tokens: 300,
          output_tokens_details: { reasoning_tokens: 100 },
          total_tokens: 1_300,
        },
        price,
      ),
    ).toMatchObject({
      actualCostMicroUsd: 529,
      normalizedUsage: {
        uncachedInputTokens: 700,
        outputTokens: 300,
        reasoningTokens: 100,
      },
    });
  });

  test("uses the official Responses structured-output fields and settles actual usage", async () => {
    const config = liveConfig();
    const store = new Store(mkdtempSync(join(tmpdir(), "factory-provider-")));
    let request: any;
    const client = {
      responses: {
        create: async (body: any) => {
          request = body;
          return completed(fixtureOutput("scout", {}));
        },
      },
    };
    const provider = new ModelProvider(config, store, {
      openai: client as any,
    });

    const output = await provider.invoke({
      agent: "scout",
      input: { source: "bounded" },
      runId: "run-1",
      leadId: "lead-1",
      stepId: "step-1",
    });

    expect(output.data).not.toBeNull();
    expect(request).toMatchObject({
      model: "gpt-5.6-luna",
      max_output_tokens: 6_000,
      store: false,
      service_tier: "default",
      reasoning: { effort: "low" },
      text: {
        format: { type: "json_schema", name: "ScoutOutput", strict: true },
      },
    });
    expect(request.instructions).toContain("JSON-Schema");
    expect(store.getBudgetStatus({ runId: "run-1" })).toMatchObject({
      settledMicroUsd: 529,
      reservedMicroUsd: 0,
      uncertainMicroUsd: 0,
    });
    expect(store.countDispatches("step-1")).toBe(1);
    store.close();
  });

  test("holds the full reserve when usage fields are missing", async () => {
    const config = liveConfig();
    const store = new Store(mkdtempSync(join(tmpdir(), "factory-provider-")));
    const client = {
      responses: {
        create: async () => completed(fixtureOutput("scout", {}), null),
      },
    };
    const provider = new ModelProvider(config, store, {
      openai: client as any,
    });

    await provider.invoke({
      agent: "scout",
      input: {},
      runId: "run-1",
      leadId: "lead-1",
      stepId: "step-1",
    });

    expect(store.getBudgetStatus({ runId: "run-1" })).toMatchObject({
      settledMicroUsd: 0,
      uncertainMicroUsd: 13_200,
    });
    expect(
      store.getAttempt(
        (store.db.prepare("SELECT attempt_id FROM agent_attempts").get() as any)
          .attempt_id,
      ),
    ).toMatchObject({ actualCostMicroUsd: null, billingStatus: "uncertain" });
    store.close();
  });

  test("does not retry or upgrade a refusal", async () => {
    const config = liveConfig();
    const store = new Store(mkdtempSync(join(tmpdir(), "factory-provider-")));
    let calls = 0;
    const client = {
      responses: {
        create: async () => {
          calls++;
          return {
            ...completed({}),
            output: [
              {
                type: "message",
                content: [{ type: "refusal", refusal: "cannot comply" }],
              },
            ],
          };
        },
      },
    };
    const provider = new ModelProvider(config, store, {
      openai: client as any,
    });

    await expect(
      provider.invoke({
        agent: "scout",
        input: {},
        runId: "run-1",
        leadId: "lead-1",
        stepId: "step-1",
      }),
    ).rejects.toMatchObject({ code: "REFUSAL" });
    expect(calls).toBe(1);
    expect(store.countDispatches("step-1")).toBe(1);
    store.close();
  });

  test("one schema repair shares the global three-dispatch counter", async () => {
    const config = liveConfig();
    const store = new Store(mkdtempSync(join(tmpdir(), "factory-provider-")));
    let calls = 0;
    const client = {
      responses: {
        create: async () =>
          ++calls === 1
            ? completed({ invalid: true })
            : completed(fixtureOutput("scout", {})),
      },
    };
    const provider = new ModelProvider(config, store, {
      openai: client as any,
    });

    await provider.invoke({
      agent: "scout",
      input: {},
      runId: "run-1",
      leadId: "lead-1",
      stepId: "step-1",
    });

    expect(calls).toBe(2);
    expect(store.countDispatches("step-1")).toBe(2);
    expect(
      store.db
        .prepare(
          "SELECT COUNT(*) count FROM agent_attempts WHERE kind='output_repair'",
        )
        .get(),
    ).toMatchObject({ count: 1 });
    store.close();
  });

  test("rejects model overrides outside the bounded escalation matrix before dispatch", async () => {
    const config = liveConfig();
    config.escalation.enabled = true;
    const store = new Store(mkdtempSync(join(tmpdir(), "factory-provider-")));
    const provider = new ModelProvider(config, store, {
      openai: { responses: { create: async () => completed({}) } } as any,
    });

    await expect(
      provider.invoke({
        agent: "scout",
        input: {},
        runId: "run-1",
        leadId: "lead-1",
        stepId: "step-1",
        modelOverride: "gpt-5.6-sol",
      }),
    ).rejects.toBeInstanceOf(ProviderError);
    expect(store.countDispatches("step-1")).toBe(0);
    store.close();
  });

  test("doctor runs every distinct configured capability smoke and reuses the result for 24 hours", async () => {
    const config = liveConfig();
    const store = new Store(mkdtempSync(join(tmpdir(), "factory-provider-")));
    const requests: any[] = [];
    const client = {
      responses: {
        create: async (body: any) => {
          requests.push(body);
          return {
            ...completed(
              { ok: true },
              {
                input_tokens: 100,
                input_tokens_details: {
                  cached_tokens: 0,
                  cache_write_tokens: 0,
                },
                output_tokens: 5,
                output_tokens_details: { reasoning_tokens: 2 },
                total_tokens: 105,
              },
            ),
            model: body.model,
          };
        },
      },
    };
    const provider = new ModelProvider(config, store, {
      openai: client as any,
    });

    const first = await provider.doctor();
    const second = await provider.doctor();

    expect(first).toMatchObject({
      mode: "live",
      ok: true,
      paid: true,
      smokeCount: 4,
    });
    expect(second).toMatchObject({ mode: "live", ok: true, smokeCount: 4 });
    expect(requests).toHaveLength(4);
    expect(
      requests.map((request) => [request.model, request.reasoning.effort]),
    ).toEqual([
      ["gpt-5.6-luna", "low"],
      ["gpt-5.6-terra", "low"],
      ["gpt-5.6-terra", "medium"],
      ["gpt-5.6-terra", "medium"],
    ]);
    expect(
      requests.filter((request) =>
        request.input[0].content.some(
          (item: any) => item.type === "input_image",
        ),
      ),
    ).toHaveLength(2);
    expect(
      store.getBudgetStatus({ dayKey: new Date().toISOString().slice(0, 10) })
        .settledMicroUsd,
    ).toBeGreaterThan(0);
    store.close();
  });

  test("rejects an oversized full request before creating a paid dispatch", async () => {
    const config = liveConfig();
    const store = new Store(mkdtempSync(join(tmpdir(), "factory-provider-")));
    let calls = 0;
    const provider = new ModelProvider(config, store, {
      openai: {
        responses: {
          create: async () => {
            calls++;
            return completed({});
          },
        },
      } as any,
    });
    await expect(
      provider.invoke({
        agent: "scout",
        input: { payload: "x".repeat(30_000) },
        runId: "run-1",
        leadId: "lead-1",
        stepId: "oversized",
      }),
    ).rejects.toMatchObject({ code: "INPUT_LIMIT" });
    expect(calls).toBe(0);
    expect(store.countDispatches("oversized")).toBe(0);
    store.close();
  });

  test("budgets a normal large screenshot by documented vision patches rather than base64 bytes", async () => {
    const config = liveConfig();
    const dir = mkdtempSync(join(tmpdir(), "factory-provider-"));
    const imagePath = join(dir, "screenshot.png");
    // A representative large screenshot payload. The adapter does not infer token cost
    // from compressed bytes because GPT-5.6 bills high-detail inputs by capped patches.
    const screenshot = screenshotPng();
    expect(screenshot.length).toBeGreaterThan(200_000);
    expect(screenshot.length).toBeLessThan(1_000_000);
    writeFileSync(imagePath, screenshot);
    const screenshotHash = createHash("sha256")
      .update(screenshot)
      .digest("hex");
    const store = new Store(join(dir, "db"));
    let calls = 0;
    const provider = new ModelProvider(config, store, {
      openai: {
        responses: {
          create: async () => {
            calls++;
            return completed(
              fixtureOutput("audit", {}),
              undefined,
              "gpt-5.6-terra",
            );
          },
        },
      } as any,
    });
    await provider.invoke({
      agent: "audit",
      input: {
        images: [
          {
            evidence_id: "e-screen",
            attachment_ref: imagePath,
            sha256: screenshotHash,
          },
        ],
      },
      images: [
        { path: imagePath, evidence_id: "e-screen", sha256: screenshotHash },
      ],
      runId: "run-1",
      leadId: "lead-1",
      stepId: "visual",
    });
    expect(calls).toBe(1);
    store.close();
  });

  test("rejects changed image bytes before a paid dispatch", async () => {
    const config = liveConfig();
    const dir = mkdtempSync(join(tmpdir(), "factory-provider-image-binding-"));
    const imagePath = join(dir, "screen.png");
    const original = screenshotPng();
    const originalHash = createHash("sha256").update(original).digest("hex");
    writeFileSync(imagePath, original);
    writeFileSync(imagePath, Buffer.concat([original, Buffer.from("changed")]));
    const store = new Store(join(dir, "db"));
    let calls = 0;
    const provider = new ModelProvider(config, store, {
      openai: {
        responses: {
          create: async () => {
            calls++;
            return completed({});
          },
        },
      } as any,
    });
    await expect(
      provider.invoke({
        agent: "audit",
        input: {
          images: [
            {
              evidence_id: "screen",
              attachment_ref: imagePath,
              sha256: originalHash,
            },
          ],
        },
        images: [{ path: imagePath, evidence_id: "screen" }],
        runId: "run",
        leadId: "lead",
        stepId: "tampered",
      }),
    ).rejects.toMatchObject({ code: "IMAGE_HASH_MISMATCH" });
    expect(calls).toBe(0);
    expect(store.countDispatches("tampered")).toBe(0);
    store.close();
  });

  test("holds the reserve uncertain when the provider reports a different model", async () => {
    const config = liveConfig();
    const store = new Store(
      mkdtempSync(join(tmpdir(), "factory-provider-model-")),
    );
    const provider = new ModelProvider(config, store, {
      openai: {
        responses: {
          create: async () => ({
            ...completed(fixtureOutput("scout", {})),
            model: "gpt-5.6-terra",
          }),
        },
      } as any,
    });
    await expect(
      provider.invoke({
        agent: "scout",
        input: {},
        runId: "run",
        leadId: "lead",
        stepId: "model-mismatch",
      }),
    ).rejects.toMatchObject({ code: "UNEXPECTED_MODEL" });
    expect(store.getBudgetStatus({ runId: "run" }).uncertainMicroUsd).toBe(
      13_200,
    );
    store.close();
  });

  test("holds a 5xx reservation as uncertain when no usage is available", async () => {
    const config = liveConfig();
    config.limits.maxDispatches = 1;
    const store = new Store(mkdtempSync(join(tmpdir(), "factory-provider-")));
    const provider = new ModelProvider(config, store, {
      openai: {
        responses: {
          create: async () => {
            throw Object.assign(new Error("server"), { status: 500 });
          },
        },
      } as any,
    });
    await expect(
      provider.invoke({
        agent: "scout",
        input: {},
        runId: "run-1",
        leadId: "lead-1",
        stepId: "server-error",
      }),
    ).rejects.toMatchObject({ code: "TRANSIENT_LIMIT" });
    expect(store.getBudgetStatus({ runId: "run-1" }).uncertainMicroUsd).toBe(
      13_200,
    );
    store.close();
  });

  test("resume cannot reset persisted dispatch or repair counters", async () => {
    const config = liveConfig();
    const store = new Store(mkdtempSync(join(tmpdir(), "factory-provider-")));
    for (let index = 0; index < 3; index++) {
      const attemptId = `old-${index}`;
      store.createAttempt({
        attemptId,
        stepId: "exhausted",
        runId: "run-1",
        leadId: "lead-1",
        agent: "scout",
        model: "gpt-5.6-luna",
        kind: index === 2 ? "output_repair" : "transient_retry",
      });
      store.updateAttempt(attemptId, { state: "failed" });
    }
    store.createAttempt({
      attemptId: "old-repair",
      stepId: "repair-used",
      runId: "run-1",
      leadId: "lead-1",
      agent: "scout",
      model: "gpt-5.6-luna",
      kind: "output_repair",
    });
    store.updateAttempt("old-repair", { state: "failed" });
    let calls = 0;
    const provider = new ModelProvider(config, store, {
      openai: {
        responses: {
          create: async () => {
            calls++;
            return completed({});
          },
        },
      } as any,
    });

    await expect(
      provider.invoke({
        agent: "scout",
        input: {},
        runId: "run-1",
        leadId: "lead-1",
        stepId: "exhausted",
      }),
    ).rejects.toMatchObject({ code: "DISPATCH_LIMIT" });
    await expect(
      provider.invoke({
        agent: "scout",
        input: {},
        runId: "run-1",
        leadId: "lead-1",
        stepId: "repair-used",
        repair: { reason: "SCHEMA_ERROR" },
      }),
    ).rejects.toMatchObject({ code: "SCHEMA_REPAIR_LIMIT" });
    expect(calls).toBe(0);
    store.close();
  });
});
