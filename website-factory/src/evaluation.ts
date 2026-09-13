import { createHash, randomInt, randomUUID } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { processAgentOutput, promptFor } from "./agents.js";
import {
  hash,
  ROOT_NAMES,
  schemaFor,
  validate,
  type AgentName,
  type JsonObject,
} from "./contracts.js";
import type { FactoryConfig } from "./config.js";
import { fixtureOutput } from "./fixtures.js";
import { ModelProvider } from "./provider.js";
import type { Store } from "./store.js";

type EvaluationProvider = Pick<ModelProvider, "invoke"> & {
  doctor?: ModelProvider["doctor"];
};
type ProviderFactory = (
  config: FactoryConfig,
  store: Store,
) => EvaluationProvider;

const categories = [
  ...Array(5).fill("simple_ch_service"),
  ...Array(4).fill("incomplete_conflicting_identity_contact"),
  ...Array(3).fill("agency_evidence"),
  ...Array(3).fill("mobile_images_partial_crawl"),
  ...Array(3).fill("unsupported_shop_portal_integration"),
  ...Array(2).fill("controlled_injection"),
] as string[];

const upperModel: Record<AgentName, string> = {
  scout: "gpt-5.6-terra",
  audit: "gpt-5.6-sol",
  qualifier: "gpt-5.6-terra",
  strategist: "gpt-5.6-sol",
  builder: "gpt-5.6-terra",
  qa: "gpt-5.6-sol",
  sales: "gpt-5.6-terra",
};
const lowerModel: Record<AgentName, string> = {
  scout: "gpt-5.6-luna",
  audit: "gpt-5.6-terra",
  qualifier: "gpt-5.6-luna",
  strategist: "gpt-5.6-terra",
  builder: "gpt-5.6-luna",
  qa: "gpt-5.6-terra",
  sales: "gpt-5.6-luna",
};

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value as JsonObject;
}

function requiredText(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`${label} is required`);
  return value;
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class Evaluation {
  constructor(
    private readonly config: FactoryConfig,
    private readonly store: Store,
    private readonly providerFactory: ProviderFactory = (config, store) =>
      new ModelProvider(config, store),
  ) {}

  initSuite(name = "representative-20"): JsonObject {
    requiredText(name, "suite name");
    const existing = this.store.get("evaluation_suites", name);
    if (existing) return existing;
    const suite = {
      name,
      createdAt: new Date().toISOString(),
      slots: categories.map((category, index) => ({
        slotNumber: index + 1,
        category,
        filled: false,
        caseId: null,
      })),
    };
    this.store.put("evaluation_suites", name, suite);
    return this.store.get("evaluation_suites", name);
  }

  importCase(suiteName: string, file: string): JsonObject {
    const suite = this.requireSuite(suiteName);
    const source = object(
      JSON.parse(readFileSync(resolve(file), "utf8")),
      "evaluation case",
    );
    const slotNumber = source.slot_number;
    if (!Number.isInteger(slotNumber) || slotNumber < 1 || slotNumber > 20)
      throw new Error("slot_number must be an integer from 1 to 20");
    const slot = suite.slots.find(
      (item: JsonObject) => item.slotNumber === slotNumber,
    );
    if (!slot || slot.filled)
      throw new Error(`Evaluation slot ${slotNumber} is already filled`);
    const provenance = object(source.source_provenance, "source provenance");
    requiredText(provenance.description, "source provenance description");
    const capturedAt = requiredText(
      provenance.captured_at,
      "source provenance captured_at",
    );
    if (!Number.isFinite(Date.parse(capturedAt)))
      throw new Error("source provenance captured_at must be an ISO date");
    requiredText(
      source.usage_permission_description,
      "usage permission description",
    );
    const agent = requiredText(source.agent, "agent") as AgentName;
    if (!(agent in ROOT_NAMES))
      throw new Error(`Unknown evaluation agent ${agent}`);
    const input = validate(`${ROOT_NAMES[agent]}Input`, source.input);
    if (source.input_hash !== hash(input))
      throw new Error("Evaluation input hash does not match the strict input");
    const reference = object(source.human_reference, "human reference");
    requiredText(
      reference.reviewer_identity,
      "human reference reviewer identity",
    );
    const reviewedAt = requiredText(
      reference.reviewed_at,
      "human reference reviewed_at",
    );
    if (!Number.isFinite(Date.parse(reviewedAt)))
      throw new Error("human reference reviewed_at must be an ISO date");
    object(reference.expected, "human reference expected");

    const caseId = randomUUID();
    const frozenDir = join(
      this.config.dataDir,
      "evaluation",
      hash(suiteName),
      caseId,
    );
    mkdirSync(frozenDir, { recursive: true });
    const attachments = (source.image_attachments ?? []) as unknown;
    if (!Array.isArray(attachments))
      throw new Error("image_attachments must be an array");
    const frozenAttachments: JsonObject[] = attachments.map((raw, index) => {
      const attachment = object(raw, `image attachment ${index + 1}`);
      const sourcePath = resolve(
        requiredText(attachment.path, `image attachment ${index + 1} path`),
      );
      const expectedHash = requiredText(
        attachment.sha256,
        `image attachment ${index + 1} sha256`,
      ).toLowerCase();
      if (sha256File(sourcePath) !== expectedHash)
        throw new Error(
          `Image attachment ${index + 1} content hash does not match`,
        );
      const destination = join(
        frozenDir,
        `${index + 1}-${basename(sourcePath)}`,
      );
      copyFileSync(sourcePath, destination);
      return { ...attachment, path: destination, sha256: expectedHash };
    });
    const frozenInput = clone(input);
    if (Array.isArray(frozenInput.images))
      for (const image of frozenInput.images as JsonObject[]) {
        const attachment = frozenAttachments.find(
          (candidate) => candidate.evidence_id === image.evidence_id,
        );
        if (!attachment)
          throw new Error(
            `Missing frozen attachment for input image ${image.evidence_id}`,
          );
        image.attachment_ref = attachment.path;
        image.sha256 = attachment.sha256;
      }
    validate(`${ROOT_NAMES[agent]}Input`, frozenInput);
    const provenanceFiles = (provenance.source_files ?? []) as unknown;
    if (!Array.isArray(provenanceFiles))
      throw new Error("source_provenance.source_files must be an array");
    const frozenSources = provenanceFiles.map((raw, index) =>
      this.freezeFile(raw, frozenDir, `source-${index + 1}`),
    );
    const frozenCase = {
      caseId,
      suite: suiteName,
      slotNumber,
      category: slot.category,
      sourceProvenance: { ...provenance, source_files: frozenSources },
      usagePermissionDescription: source.usage_permission_description,
      agent,
      input: frozenInput,
      inputHash: hash(frozenInput),
      importedInputHash: source.input_hash,
      humanReference: reference,
      imageAttachments: frozenAttachments,
      importedAt: new Date().toISOString(),
    };
    writeFileSync(
      join(frozenDir, "case.json"),
      JSON.stringify(frozenCase, null, 2),
    );
    this.store.transaction(() => {
      this.store.put("evaluation_cases", caseId, frozenCase);
      slot.filled = true;
      slot.caseId = caseId;
      this.store.put("evaluation_suites", suiteName, {
        ...suite,
        slots: suite.slots,
      });
    });
    return clone(frozenCase);
  }

  async runSuite(suiteName: string): Promise<JsonObject> {
    const suite = this.requireSuite(suiteName);
    if (this.config.mode === "live") {
      this.assertLiveReady(suite);
      await this.ensureLiveCapabilities();
    }
    const cases = suite.slots
      .filter((slot: JsonObject) => slot.filled)
      .map((slot: JsonObject) =>
        this.store.get("evaluation_cases", slot.caseId),
      );
    const publicResults: JsonObject[] = [];
    let reused = 0;
    for (const evaluationCase of cases) {
      const agent = evaluationCase.agent as AgentName;
      const lower = this.config.models[agent].model;
      const upper = upperModel[agent];
      const models = [lower, upper];
      const blind = this.blindAssignment(evaluationCase.caseId);
      for (const model of models) {
        const cacheKey = this.cacheKey(evaluationCase, model);
        const resultId = this.resultIdFor(
          suiteName,
          evaluationCase.caseId,
          model,
          cacheKey,
        );
        let result = this.store.get("evaluation_results", resultId);
        if (result?.finished) reused++;
        else
          result = await this.executeVariant(
            evaluationCase,
            model,
            resultId,
            blind[model],
            cacheKey,
          );
        publicResults.push(this.publicResult(result));
      }
    }
    return {
      suite: suiteName,
      results: publicResults.sort((a, b) => a.label.localeCompare(b.label)),
      reused,
      synthetic: this.config.mode === "fixture",
    };
  }

  review(resultId: string, reviewValue: JsonObject): JsonObject {
    const result = this.store.get("evaluation_results", resultId);
    if (!result?.finished)
      throw new Error(`Unknown or unfinished evaluation result ${resultId}`);
    const review = object(reviewValue, "review");
    requiredText(review.human_identity, "human identity");
    if (typeof review.accepted !== "boolean")
      throw new Error("accepted must be boolean");
    requiredText(review.reason, "review reason");
    for (const key of [
      "fact_errors",
      "unsupported_claims",
      "schema_errors",
      "missed_qa_issues",
      "false_positive_qa_issues",
    ]) {
      if (!Number.isSafeInteger(review[key]) || review[key] < 0)
        throw new Error(`${key} must be a non-negative integer`);
    }
    if (
      typeof review.correction_minutes !== "number" ||
      !Number.isFinite(review.correction_minutes) ||
      review.correction_minutes < 0
    )
      throw new Error("correction_minutes must be non-negative");
    if (review.output_hash !== result.outputHash)
      throw new Error(
        "Stale review: output hash does not match the current result",
      );
    const saved = { ...review, resultId, reviewedAt: new Date().toISOString() };
    this.store.put("evaluation_reviews", resultId, saved);
    return clone(saved);
  }

  report(suiteName: string): JsonObject {
    const suite = this.requireSuite(suiteName);
    const filled = suite.slots.filter((slot: JsonObject) => slot.filled);
    const expected: string[] = filled.flatMap((slot: JsonObject) => {
      const evaluationCase = this.store.get("evaluation_cases", slot.caseId);
      const agent = evaluationCase.agent as AgentName;
      return [this.config.models[agent].model, upperModel[agent]].map((model) =>
        this.resultIdFor(
          suiteName,
          evaluationCase.caseId,
          model,
          this.cacheKey(evaluationCase, model),
        ),
      );
    });
    const results: JsonObject[] = expected
      .map((resultId: string) => this.store.get("evaluation_results", resultId))
      .filter((result: JsonObject | null): result is JsonObject =>
        Boolean(result),
      );
    const modelNames: string[] = [
      ...new Set<string>(
        results.map((result: JsonObject) => result.model as string),
      ),
    ];
    const models: JsonObject = {};
    let pendingReviews = 0;
    for (const model of modelNames) {
      const items = results.filter(
        (result: JsonObject) => result.model === model,
      );
      const finished = items.filter((result: JsonObject) => result.finished);
      const reviews = finished.map((result: JsonObject) =>
        this.store.get("evaluation_reviews", result.id),
      );
      const accepted = reviews.filter(
        (review: JsonObject | null) => review?.accepted === true,
      ).length;
      const rejected = reviews.filter(
        (review: JsonObject | null) => review?.accepted === false,
      ).length;
      const pending = reviews.filter(
        (review: JsonObject | null) => !review,
      ).length;
      pendingReviews += pending;
      const uncertain = items.filter(
        (result: JsonObject) => result.costMicroUsd === null,
      ).length;
      const totalCost = uncertain
        ? null
        : items.reduce(
            (sum: number, result: JsonObject) => sum + result.costMicroUsd,
            0,
          );
      const metricKeys = [
        "fact_errors",
        "unsupported_claims",
        "schema_errors",
        "missed_qa_issues",
        "false_positive_qa_issues",
        "correction_minutes",
      ];
      const reviewMetrics = Object.fromEntries(
        metricKeys.map((key) => [
          key,
          reviews.reduce(
            (sum: number, review: JsonObject | null) =>
              sum + (review?.[key] ?? 0),
            0,
          ),
        ]),
      );
      models[model] = {
        executed: items.length,
        failedResults: items.length - finished.length,
        accepted,
        rejected,
        pendingReviews: pending,
        uncertainCostResults: uncertain,
        reviewMetrics,
        totalCostMicroUsd: totalCost,
        costPerAcceptedMicroUsd:
          accepted > 0 && totalCost !== null ? totalCost / accepted : null,
      };
    }
    const unfilledSlots = 20 - filled.length;
    const unexecuted = Math.max(0, filled.length * 2 - results.length);
    const failedResults = results.filter(
      (result: JsonObject) => !result.finished,
    ).length;
    const complete =
      this.config.mode === "live" &&
      unfilledSlots === 0 &&
      unexecuted === 0 &&
      failedResults === 0 &&
      pendingReviews === 0;
    return {
      suite: suiteName,
      complete,
      recommendation: null,
      unfilledSlots,
      unexecutedResults: unexecuted,
      failedResults,
      pendingReviews,
      models,
    };
  }

  private requireSuite(name: string): JsonObject {
    const suite = this.store.get("evaluation_suites", name);
    if (!suite) throw new Error(`Unknown evaluation suite ${name}`);
    return suite;
  }

  private assertLiveReady(suite: JsonObject): void {
    const { evaluationScopeId, evaluationMicroUsd, spendScopeId } =
      this.config.budgets;
    if (
      typeof evaluationScopeId !== "string" ||
      !evaluationScopeId.trim() ||
      evaluationScopeId === spendScopeId ||
      !Number.isSafeInteger(evaluationMicroUsd) ||
      (evaluationMicroUsd as number) <= 0
    ) {
      throw new Error(
        "A dedicated evaluation budget scope and positive evaluation budget are required for live evaluation",
      );
    }
    if (suite.slots.some((slot: JsonObject) => !slot.filled))
      throw new Error(
        "Live evaluation requires all 20 filled slots with human references",
      );
    for (const evaluationCase of suite.slots.map((slot: JsonObject) =>
      this.store.get("evaluation_cases", slot.caseId),
    )) {
      if (
        this.config.models[evaluationCase.agent as AgentName].model !==
        lowerModel[evaluationCase.agent as AgentName]
      ) {
        throw new Error(
          `Live evaluation requires the configured lower model for ${evaluationCase.agent}`,
        );
      }
    }
  }

  private blindAssignment(caseId: string): Record<string, "A" | "B"> {
    const existing = this.store.get("evaluation_blinds", caseId);
    if (existing) return existing.assignment;
    const agent = this.store.get("evaluation_cases", caseId).agent as AgentName;
    const lower = this.config.models[agent].model,
      upper = upperModel[agent];
    const assignment =
      randomInt(2) === 0
        ? { [lower]: "A" as const, [upper]: "B" as const }
        : { [lower]: "B" as const, [upper]: "A" as const };
    this.store.put("evaluation_blinds", caseId, { assignment });
    return assignment;
  }

  private async executeVariant(
    evaluationCase: JsonObject,
    model: string,
    resultId: string,
    label: "A" | "B",
    cacheKey: string,
  ): Promise<JsonObject> {
    const agent = evaluationCase.agent as AgentName;
    const cached = this.store.get("evaluation_cache", cacheKey);
    if (cached) {
      const result = {
        ...cached,
        resultId,
        suite: evaluationCase.suite,
        caseId: evaluationCase.caseId,
        slotNumber: evaluationCase.slotNumber,
        label,
        model,
        inputHash: evaluationCase.inputHash,
        cacheKey,
        finished: true,
        reusedFromCache: true,
        attemptIds: [],
        latencyMs: 0,
        costMicroUsd: 0,
      };
      this.store.put("evaluation_results", resultId, result);
      return this.store.get("evaluation_results", resultId);
    }
    const started = Date.now();
    let output: JsonObject | null = null,
      error: JsonObject | null = null,
      attemptIds: string[] = [];
    let rawOutput: JsonObject | null = null;
    if (this.config.mode === "fixture") {
      rawOutput = fixtureOutput(agent, evaluationCase.input);
      output = processAgentOutput(agent, rawOutput, evaluationCase.input);
    } else {
      const variantConfig = this.variantConfig(agent, model);
      const stepId = `evaluation:${evaluationCase.suite}:${evaluationCase.caseId}:${model}`;
      try {
        rawOutput = await this.providerFactory(
          variantConfig,
          this.store,
        ).invoke({
          agent,
          input: evaluationCase.input,
          runId: `evaluation:${evaluationCase.suite}`,
          leadId: `evaluation:${evaluationCase.caseId}`,
          stepId,
          images: evaluationCase.imageAttachments.map(
            (attachment: JsonObject) => ({
              path: attachment.path,
              evidence_id: attachment.evidence_id ?? attachment.sha256,
              sha256: attachment.sha256,
            }),
          ),
        });
        output = processAgentOutput(agent, rawOutput, evaluationCase.input);
      } catch (caught) {
        error = {
          name: caught instanceof Error ? caught.name : "Error",
          message: caught instanceof Error ? caught.message : String(caught),
        };
      }
      attemptIds = (
        this.store.db
          .prepare(
            "SELECT attempt_id FROM agent_attempts WHERE step_id=? ORDER BY created_at,attempt_id",
          )
          .all(stepId) as Array<{ attempt_id: string }>
      ).map((row) => row.attempt_id);
    }
    const attempts = attemptIds.map((attemptId) =>
      this.store.getAttempt(attemptId),
    );
    const unknownCost = attempts.some(
      (attempt) =>
        attempt?.billingStatus === "uncertain" ||
        (attempt?.billingStatus === "settled" &&
          attempt.actualCostMicroUsd === null),
    );
    const costMicroUsd =
      this.config.mode === "fixture"
        ? 0
        : unknownCost
          ? null
          : attempts.reduce(
              (sum, attempt) => sum + (attempt?.actualCostMicroUsd ?? 0),
              0,
            );
    const outputHash = hash(output ?? error);
    const result = {
      resultId,
      suite: evaluationCase.suite,
      caseId: evaluationCase.caseId,
      slotNumber: evaluationCase.slotNumber,
      label,
      model,
      inputHash: evaluationCase.inputHash,
      outputHash,
      rawOutput,
      output,
      error,
      synthetic: this.config.mode === "fixture",
      attemptIds,
      latencyMs: Date.now() - started,
      costMicroUsd,
      cacheKey,
      finished: output !== null,
    };
    this.store.put("evaluation_results", resultId, result);
    if (result.finished)
      this.store.put("evaluation_cache", cacheKey, {
        rawOutput,
        output,
        error,
        outputHash,
        synthetic: result.synthetic,
      });
    return this.store.get("evaluation_results", resultId);
  }

  private variantConfig(agent: AgentName, model: string): FactoryConfig {
    const config = clone(this.config);
    config.models[agent] = { ...config.models[agent], model };
    config.escalation.enabled = false;
    return config.mode === "live" ? this.withEvaluationBudget(config) : config;
  }

  private withEvaluationBudget(config: FactoryConfig): FactoryConfig {
    const limit = config.budgets.evaluationMicroUsd as number;
    config.budgets = {
      ...config.budgets,
      spendScopeId: config.budgets.evaluationScopeId ?? null,
      totalMicroUsd: limit,
      leadMicroUsd: Math.min(config.budgets.leadMicroUsd ?? limit, limit),
      runMicroUsd: Math.min(config.budgets.runMicroUsd ?? limit, limit),
      dayMicroUsd: Math.min(config.budgets.dayMicroUsd ?? limit, limit),
    };
    return config;
  }

  private async ensureLiveCapabilities(): Promise<void> {
    const lower = this.withEvaluationBudget(clone(this.config));
    lower.escalation.enabled = false;
    const upper = clone(lower);
    for (const agent of Object.keys(upper.models) as AgentName[])
      upper.models[agent] = {
        ...upper.models[agent],
        model: upperModel[agent],
      };
    for (const config of [lower, upper]) {
      const provider = this.providerFactory(config, this.store);
      if (typeof provider.doctor !== "function")
        throw new Error(
          "Live evaluation provider must support budgeted capability checks",
        );
      await provider.doctor();
    }
  }

  private cacheKey(evaluationCase: JsonObject, model: string): string {
    const agent = evaluationCase.agent as AgentName;
    const config = this.variantConfig(agent, model);
    const configHash = hash({
      mode: config.mode,
      model: config.models[agent],
      price: config.prices[`${config.models[agent].provider}:${model}`],
      limits: config.limits,
    });
    return hash({
      input: evaluationCase.input,
      prompt: promptFor(agent),
      model,
      configHash,
      schema: schemaFor(`${ROOT_NAMES[agent]}Output`),
    });
  }

  private resultIdFor(
    suite: string,
    caseId: string,
    model: string,
    cacheKey: string,
  ): string {
    const variantKey = hash({ suite, caseId, model, cacheKey });
    const existing = this.store.get("evaluation_variant_ids", variantKey);
    if (existing) return existing.resultId;
    const resultId = randomUUID();
    this.store.put("evaluation_variant_ids", variantKey, { resultId });
    return resultId;
  }

  private publicResult(result: JsonObject): JsonObject {
    return {
      resultId: result.id ?? result.resultId,
      caseId: result.caseId,
      slotNumber: result.slotNumber,
      label: result.label,
      inputHash: result.inputHash,
      outputHash: result.outputHash,
      output: result.output,
      error: result.error,
      synthetic: result.synthetic,
      review: this.store.get(
        "evaluation_reviews",
        result.id ?? result.resultId,
      ),
    };
  }

  private freezeFile(
    raw: unknown,
    directory: string,
    prefix: string,
  ): JsonObject {
    const file = object(raw, prefix);
    const sourcePath = resolve(requiredText(file.path, `${prefix} path`));
    const expectedHash = requiredText(
      file.sha256,
      `${prefix} sha256`,
    ).toLowerCase();
    if (sha256File(sourcePath) !== expectedHash)
      throw new Error(`${prefix} content hash does not match`);
    const destination = join(directory, `${prefix}-${basename(sourcePath)}`);
    copyFileSync(sourcePath, destination);
    return { ...file, path: destination, sha256: expectedHash };
  }
}
