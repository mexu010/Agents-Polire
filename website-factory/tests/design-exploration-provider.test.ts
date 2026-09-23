import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { processAgentOutput } from "../src/agents.js";
import { defaultConfig } from "../src/config.js";
import {
  buildAgentInput,
  fixtureInput,
  fixtureOutput,
} from "../src/fixtures.js";
import { ModelProvider } from "../src/provider.js";
import { Store } from "../src/store.js";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function explorationFixture() {
  const directory = mkdtempSync(join(tmpdir(), "design-exploration-provider-"));
  directories.push(directory);
  const root = fixtureInput();
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
  const evidence = [];
  const images = [];
  for (let index = 0; index < 4; index += 1) {
    const bytes = Buffer.from(`representative screenshot ${index}`);
    const filename = join(directory, `reference-${index}.png`);
    writeFileSync(filename, bytes);
    evidence.push({
      ...root.evidence[0],
      evidence_id: `design-image-${index}`,
      kind: "screenshot",
    });
    images.push({
      evidence_id: `design-image-${index}`,
      attachment_ref: filename,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      width: index === 1 ? 375 : 1440,
      height: index === 1 ? 812 : 1000,
    });
  }
  const references = [0, 1, 2].map((index) => ({
    reference_id: `ref-${index}`,
    url: `https://reference-${index}.example/`,
    title: `Reference ${index}`,
    excerpt: "Navigation and services",
    evidence_ids: [],
    image_evidence_ids:
      index === 0
        ? ["design-image-0", "design-image-1"]
        : [`design-image-${index + 1}`],
  }));
  const context: any = {
    ...root,
    profile,
    audit,
    qualification,
    designResearch: {
      research: {
        status: "complete",
        industry: "Sanitär",
        query: "service website",
        source_mode: "catalog",
        captured_at: new Date().toISOString(),
        gaps: [],
        recent_designs: [],
        references,
      },
      evidence,
      images,
    },
  };
  const input = buildAgentInput("strategist", context, "design_exploration");
  const output = fixtureOutput("strategist", input);
  return { directory, context, input, output, images };
}

const usage = {
  input_tokens: 100,
  input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 },
  output_tokens: 50,
  output_tokens_details: { reasoning_tokens: 10 },
  total_tokens: 150,
};

describe("design exploration provider accounting", () => {
  it("keeps the normal Strategist with the same four-image research payload inside the original 30k limit", async () => {
    const fixture = explorationFixture();
    const input = buildAgentInput("strategist", fixture.context);
    const output = fixtureOutput("strategist", input);
    const config = structuredClone(defaultConfig());
    config.mode = "live";
    config.authentication = "api_key";
    config.dataDir = fixture.directory;
    expect(config.models.strategist.max_input_tokens).toBe(30_000);
    config.budgets = {
      leadMicroUsd: 1_000_000,
      runMicroUsd: 1_000_000,
      dayMicroUsd: 1_000_000,
      spendScopeId: "strategist-four-image-test",
      totalMicroUsd: 1_000_000,
    };
    const store = new Store(join(fixture.directory, "strategist-store"));
    let request: any;
    const openai = {
      responses: {
        create: vi.fn(async (body: any) => {
          request = body;
          return {
            id: "strategist-api",
            _request_id: "request-strategist",
            model: body.model,
            service_tier: "default",
            status: "completed",
            output_text: JSON.stringify(output),
            output: [],
            usage,
          };
        }),
      },
    };
    const provider = new ModelProvider(config, store, { openai });
    try {
      await expect(
        provider.invoke({
          agent: "strategist",
          input,
          images: fixture.images.map((image) => ({
            path: image.attachment_ref,
            evidence_id: image.evidence_id,
            sha256: image.sha256,
          })),
          runId: "strategist-four-image-run",
          leadId: "lead",
          stepId: "strategist-four-image-step",
        }),
      ).resolves.toEqual(output);
      expect(request.text.format.name).toBe("StrategistOutput");
      expect(
        request.input[0].content.filter(
          (item: any) => item.type === "input_image",
        ),
      ).toHaveLength(4);
      expect(store.countDispatches("strategist-four-image-step")).toBe(1);
    } finally {
      store.close();
    }
  });

  it("uses the strict task schema and one API budget reservation for four reference images", async () => {
    const fixture = explorationFixture();
    const config = structuredClone(defaultConfig());
    config.mode = "live";
    config.authentication = "api_key";
    config.dataDir = fixture.directory;
    config.budgets = {
      leadMicroUsd: 1_000_000,
      runMicroUsd: 1_000_000,
      dayMicroUsd: 1_000_000,
      spendScopeId: "exploration-test",
      totalMicroUsd: 1_000_000,
    };
    const store = new Store(join(fixture.directory, "api-store"));
    let request: any;
    const openai = {
      responses: {
        create: vi.fn(async (body: any) => {
          request = body;
          return {
            id: "exploration-api",
            _request_id: "request-api",
            model: body.model,
            service_tier: "default",
            status: "completed",
            output_text: JSON.stringify(fixture.output),
            output: [],
            usage,
          };
        }),
      },
    };
    const provider = new ModelProvider(config, store, { openai });
    await expect(
      provider.invoke({
        agent: "strategist",
        task: "design_exploration",
        input: fixture.input,
        images: fixture.images.map((image) => ({
          path: image.attachment_ref,
          evidence_id: image.evidence_id,
          sha256: image.sha256,
        })),
        runId: "exploration-api-run",
        leadId: "lead",
        stepId: "exploration-api-step",
      }),
    ).resolves.toEqual(fixture.output);
    expect(request.text.format).toMatchObject({
      type: "json_schema",
      name: "DesignExplorationOutput",
      strict: true,
      schema: { additionalProperties: false },
    });
    expect(
      request.input[0].content.filter(
        (item: any) => item.type === "input_image",
      ),
    ).toHaveLength(4);
    expect(store.countDispatches("exploration-api-step")).toBe(1);
    expect(
      store.db.prepare("SELECT * FROM budget_reservations").all(),
    ).toHaveLength(1);
    store.close();
  });

  it("uses the same task schema and one OAuth quota reservation for four reference images", async () => {
    const fixture = explorationFixture();
    const config = structuredClone(defaultConfig());
    config.mode = "live";
    config.authentication = "chatgpt_oauth";
    config.dataDir = fixture.directory;
    const store = new Store(join(fixture.directory, "oauth-store"));
    let oauthRequest: any;
    const oauth = {
      check: vi.fn(async () => ({
        authMode: "chatgpt" as const,
        models: ["gpt-5.6-terra"],
      })),
      run: vi.fn(async (request: any) => {
        oauthRequest = request;
        return {
          text: JSON.stringify(fixture.output),
          model: "gpt-5.6-terra",
          usage: {
            inputTokens: 100,
            cachedInputTokens: 0,
            outputTokens: 50,
            reasoningTokens: 10,
            totalTokens: 150,
          },
        };
      }),
    };
    const provider = new ModelProvider(config, store, { oauth });
    await expect(
      provider.invoke({
        agent: "strategist",
        task: "design_exploration",
        input: fixture.input,
        images: fixture.images.map((image) => ({
          path: image.attachment_ref,
          evidence_id: image.evidence_id,
          sha256: image.sha256,
        })),
        runId: "exploration-oauth-run",
        leadId: "lead",
        stepId: "exploration-oauth-step",
      }),
    ).resolves.toEqual(fixture.output);
    expect(oauth.run).toHaveBeenCalledOnce();
    expect(oauthRequest.schema).toMatchObject({ additionalProperties: false });
    expect(oauthRequest.images).toHaveLength(4);
    expect(store.countDispatches("exploration-oauth-step")).toBe(1);
    expect(store.list("oauth_calls")).toHaveLength(1);
    expect(
      store.db.prepare("SELECT * FROM budget_reservations").all(),
    ).toHaveLength(0);
    store.close();
  });
});
