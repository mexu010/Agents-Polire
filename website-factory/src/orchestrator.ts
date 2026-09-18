import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { buildAgentInput, fixtureInput, fixtureOutput } from "./fixtures.js";
import { processAgentOutput, promptFor } from "./agents.js";
import {
  hash,
  id,
  now,
  schemaFor,
  validate,
  type AgentName,
  type JsonObject,
} from "./contracts.js";
import type { FactoryConfig } from "./config.js";
import { ModelProvider } from "./provider.js";
import { renderSite, verifyArtifact } from "./renderer.js";
import { runBrowserTests } from "./browser-tests.js";
import { Store } from "./store.js";
import { businessBlocker, validateBusinessReview } from "./business.js";

type RunOptions = {
  stopAfter?: AgentName;
  runId?: string;
  experimental?: boolean;
  requireDemoDecision?: boolean;
};
type Collector = (website: string, options: JsonObject) => Promise<JsonObject>;
type AgentOutput = (
  agent: AgentName,
  input: JsonObject,
  job: JsonObject,
) => JsonObject | Promise<JsonObject>;
const TEMPLATE = {
  template_id: "local-service",
  version: "1",
  components: [
    "hero",
    "services",
    "process",
    "about",
    "contact",
    "faq",
    "testimonials",
  ],
  variants: ["split", "stacked", "cards"],
  font_pairs: ["sans", "editorial"],
  features: ["contact"],
};
function validateRevision(name: string, value: unknown): JsonObject {
  return validate(name, value);
}

export class Factory {
  private readonly provider: ModelProvider | undefined;
  private readonly renderer: typeof renderSite;
  private readonly browserRunner: typeof runBrowserTests;
  private readonly collector: Collector | undefined;
  private readonly agentOutput: AgentOutput | undefined;
  constructor(
    readonly config: FactoryConfig,
    readonly store: Store,
    options: {
      provider?: ModelProvider;
      renderer?: typeof renderSite;
      browserRunner?: typeof runBrowserTests;
      collector?: Collector;
      agentOutput?: AgentOutput;
    } = {},
  ) {
    this.provider =
      options.provider ??
      (config.mode === "live" ? new ModelProvider(config, store) : undefined);
    this.renderer = options.renderer ?? renderSite;
    this.browserRunner = options.browserRunner ?? runBrowserTests;
    this.collector = options.collector;
    this.agentOutput = options.agentOutput;
    this.store.db.exec(`CREATE TABLE IF NOT EXISTS factory_jobs(
      run_id TEXT PRIMARY KEY, lead_id TEXT NOT NULL, revision INTEGER NOT NULL, stage TEXT NOT NULL,
      status TEXT NOT NULL, value_json TEXT NOT NULL, lease_owner TEXT, lease_expires_at TEXT, fencing_token INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    ); CREATE INDEX IF NOT EXISTS factory_jobs_lead ON factory_jobs(lead_id);`);
    this.cleanupOrphans();
    this.cleanupTombstones();
  }

  async runLead(website: string, opts: RunOptions = {}): Promise<JsonObject> {
    const url = new URL(website);
    if (!["http:", "https:"].includes(url.protocol))
      throw new Error("website must use HTTP or HTTPS");
    const runId = opts.runId ?? id();
    const existing = this.row(runId);
    if (existing) {
      if (this.show(runId).website !== url.toString())
        throw new Error("run identity already belongs to another website");
      return this.resume(runId);
    }
    // Identity is unresolved before Scout; keep a provisional lead distinct to avoid unsafe domain-only merging.
    const leadId = `lead-${id()}`;
    const context =
      this.config.mode === "fixture"
        ? fixtureInput()
        : {
            seed: { website: url.toString(), operator_company_name: null },
            campaign: this.config.campaign,
            offer: this.config.offer,
            template: TEMPLATE,
            approvedAssets: [],
          };
    context.campaign =
      this.config.mode === "fixture" ? context.campaign : this.config.campaign;
    context.agency = this.config.agency;
    const job: JsonObject = {
      runId,
      leadId,
      revision: 0,
      inputVersion: 1,
      repairRounds: 0,
      stage: "discover",
      status: "queued",
      mode: this.config.mode,
      website: url.toString(),
      experimental: Boolean(opts.experimental),
      requireDemoDecision: Boolean(opts.requireDemoDecision),
      stopAfter: opts.stopAfter ?? null,
      context,
      cacheHits: 0,
      artifactHash: null,
      draftHash: null,
      fixtureDisclosure:
        this.config.mode === "fixture"
          ? "Agent outputs and visual QA judgments are simulated fixtures; rendering and browser checks are actual."
          : null,
      createdAt: now(),
      updatedAt: now(),
    };
    this.store.transaction(() =>
      this.store.db
        .prepare(
          "INSERT INTO factory_jobs(run_id,lead_id,revision,stage,status,value_json) VALUES(?,?,?,?,?,?)",
        )
        .run(runId, leadId, 0, job.stage, job.status, JSON.stringify(job)),
    );
    return this.execute(this.show(runId));
  }

  async resume(runId: string, expectedRevision?: number): Promise<JsonObject> {
    let job = this.show(runId);
    if (expectedRevision !== undefined && job.revision !== expectedRevision)
      throw new Error(
        `version conflict: expected revision ${expectedRevision}, current ${job.revision}`,
      );
    if (job.status === "cancelled")
      throw new Error("cancelled jobs cannot resume");
    if (
      job.status === "waiting_approval" ||
      job.status === "manual_review" ||
      job.status === "needs_input" ||
      job.status === "done"
    )
      return job;
    const wasPaused = job.status === "paused";
    job.status = "queued";
    if (wasPaused || job.stopAfter) job.stopAfter = null;
    job = this.save(job, job.revision);
    return this.execute(job);
  }

  show(runId: string): JsonObject {
    const row = this.row(runId);
    if (!row) throw new Error(`Unknown run ${runId}`);
    return {
      id: runId,
      ...JSON.parse(row.value_json),
      revision: row.revision,
      stage: row.stage,
      status: row.status,
      fencingToken: row.fencing_token,
    };
  }

  review(runId: string): JsonObject {
    const job = this.show(runId);
    const review = job.context.demoReview;
    if (!review || review.reviewHash !== hash(review.summary))
      throw new Error("current analysis review is not available");
    return { runId, revision: job.revision, ...review };
  }

  async decideDemo(
    runId: string,
    decision: "approve" | "reject",
    expectedRevision: number,
    expectedReviewHash: string,
  ): Promise<JsonObject> {
    if (!(["approve", "reject"] as string[]).includes(decision))
      throw new Error("demo decision must be approve or reject");
    const saved = this.store.transaction(() => {
      const job = this.show(runId);
      if (job.revision !== expectedRevision)
        throw new Error("version conflict for demo decision");
      if (job.stage !== "demo_review" || job.status !== "waiting_approval")
        throw new Error("demo is not waiting for a decision");
      const review = this.review(runId);
      const currentReview = this.analysisReview(job);
      if (
        review.reviewHash !== expectedReviewHash ||
        currentReview.reviewHash !== expectedReviewHash
      )
        throw new Error("analysis review hash does not match current review");
      if (
        decision === "approve" &&
        !currentReview.summary.eligibility.canApprove
      )
        throw new Error(
          `demo is not eligible: ${currentReview.summary.eligibility.blockers.join(", ")}`,
        );
      const record = {
        decisionId: id(),
        runId,
        leadId: job.leadId,
        decision,
        reviewHash: expectedReviewHash,
        subjectRevision: expectedRevision,
        decidedAt: now(),
      };
      this.store.put("demo_decisions", record.decisionId, record);
      job.context.demoDecision = record;
      job.stage = decision === "approve" ? "strategist" : "done";
      job.status = decision === "approve" ? "queued" : "done";
      if (decision === "approve") job.reason = null;
      return this.save(job, expectedRevision);
    });
    return decision === "approve" ? this.execute(saved) : saved;
  }

  recordBusinessReview(
    runId: string,
    expectedRevision: number,
    input: unknown,
  ): JsonObject {
    const review = validateBusinessReview(input);
    return this.store.transaction(() => {
      const job = this.show(runId);
      if (job.revision !== expectedRevision)
        throw new Error("version conflict for business review");
      if (job.status === "running" || job.status === "cancelled")
        throw new Error(
          "cannot change business review on running or cancelled job",
        );
      if (job.context.demoDecision)
        throw new Error(
          "business review is locked after demo decision; create a new reviewed revision first",
        );
      job.context.businessReview = { ...review, website: job.website };
      if (job.context.qualification)
        job.context.demoReview = this.analysisReview(job);
      return this.save(job, expectedRevision);
    });
  }

  revise(
    runId: string,
    expectedRevision: number,
    patch: {
      campaign?: JsonObject;
      offer?: JsonObject;
      agency?: JsonObject | null;
      recrawl?: boolean;
    },
  ): JsonObject {
    return this.store.transaction(() =>
      this.reviseAtomic(runId, expectedRevision, patch),
    );
  }
  private reviseAtomic(
    runId: string,
    expectedRevision: number,
    patch: {
      campaign?: JsonObject;
      offer?: JsonObject;
      agency?: JsonObject | null;
      recrawl?: boolean;
    },
  ): JsonObject {
    const allowed = new Set(["campaign", "offer", "agency", "recrawl"]);
    for (const key of Object.keys(patch))
      if (!allowed.has(key))
        throw new Error(`revision field is not allowed: ${key}`);
    const job = this.show(runId);
    if (job.revision !== expectedRevision)
      throw new Error(
        `version conflict: expected revision ${expectedRevision}, current ${job.revision}`,
      );
    if (patch.campaign !== undefined)
      validateRevision("Campaign", patch.campaign);
    if (patch.offer !== undefined) validateRevision("Offer", patch.offer);
    if (patch.agency !== undefined && patch.agency !== null)
      validateRevision("AgencyProfile", patch.agency);
    if (patch.recrawl !== undefined && typeof patch.recrawl !== "boolean")
      throw new Error("recrawl must be boolean");
    const campaignChanged =
      patch.campaign !== undefined &&
      hash(patch.campaign) !== hash(job.context.campaign);
    const offerChanged =
      patch.offer !== undefined &&
      hash(patch.offer) !== hash(job.context.offer);
    const agencyChanged =
      patch.agency !== undefined &&
      hash(patch.agency) !== hash(job.context.agency ?? null);
    if (!campaignChanged && !offerChanged && !agencyChanged && !patch.recrawl)
      return job;
    if (campaignChanged) job.context.campaign = patch.campaign;
    if (offerChanged) job.context.offer = patch.offer;
    if (agencyChanged) job.context.agency = patch.agency;
    const clear = (keys: string[]) => {
      for (const key of keys) delete job.context[key];
    };
    if (patch.recrawl || campaignChanged) {
      clear([
        "crawl",
        "businessReview",
        "profile",
        "audit",
        "qualification",
        "demoReview",
        "demoDecision",
        "brief",
        "siteSpec",
        "render",
        "browser",
        "qa",
        "preview",
        "approved_improvements",
        "sales",
      ]);
      job.stage = patch.recrawl ? "collect" : "scout";
      this.revokeApprovals(job);
      job.artifactHash = null;
      job.draftHash = null;
      job.externalPreview = null;
    } else if (offerChanged) {
      clear([
        "qualification",
        "demoReview",
        "demoDecision",
        "brief",
        "siteSpec",
        "render",
        "browser",
        "qa",
        "preview",
        "approved_improvements",
        "sales",
      ]);
      job.stage = "qualifier";
      this.revokeApprovals(job);
      job.artifactHash = null;
      job.draftHash = null;
      job.externalPreview = null;
    } else if (agencyChanged) {
      clear(["sales"]);
      job.draftHash = null;
      if (job.outreachApproval) this.revokeApproval(job.outreachApproval);
      job.outreachApproval = null;
      job.stage = job.previewApproval ? "preview_review" : "sales";
    }
    job.inputVersion = (job.inputVersion ?? 1) + 1;
    job.stopAfter = null;
    job.error = null;
    job.status =
      agencyChanged && !campaignChanged && !offerChanged && !patch.recrawl
        ? "succeeded"
        : "queued";
    return this.save(job, expectedRevision);
  }

  approvePreview(
    runId: string,
    expectedHash: string,
    expectedRevision?: number,
  ): JsonObject {
    const job = this.show(runId);
    const revision = expectedRevision ?? job.revision;
    if (job.revision !== revision)
      throw new Error("version conflict for preview approval");
    if (job.stage !== "preview_review" || job.status !== "waiting_approval")
      throw new Error("preview is not waiting for approval");
    const reset = this.resetBlockedDemoApproval(job, revision);
    if (reset) return reset;
    this.assertArtifact(job, expectedHash);
    const expires = job.context.render.manifest.expires_at;
    if (Date.parse(expires) <= Date.now())
      throw new Error("preview artifact has expired");
    const approval = validate("Approval", {
      approval_id: id(),
      kind: "preview",
      operator_id: "local-operator",
      approved_at: now(),
      expires_at: expires,
      artifact_manifest_hash: expectedHash,
      subject_revision: job.revision,
      expected_revision: revision,
      revoked_at: null,
      final_text_hash: null,
      recipient_hash: null,
      contact_permission_revision: null,
      preview_approval_id: null,
    });
    return this.store.transaction(() => {
      this.store.put("approvals", approval.approval_id, approval);
      job.previewApproval = approval;
      job.status = "succeeded";
      return this.save(job, job.revision);
    });
  }

  attachExternalPreview(
    runId: string,
    url: string,
    expectedHash: string,
    fixtureSimulated = false,
  ): JsonObject {
    const job = this.show(runId);
    if (!job.previewApproval) throw new Error("preview approval is required");
    this.assertArtifact(job, expectedHash);
    const parsed = new URL(url);
    if (parsed.protocol !== "https:")
      throw new Error("external preview must use HTTPS");
    if (
      this.config.mode !== "fixture" ||
      !fixtureSimulated ||
      !parsed.hostname.endsWith(".test")
    )
      throw new Error(
        "external live preview verification requires a configured hosting adapter; only explicit .test fixture simulation is available",
      );
    const changed = job.context.preview?.preview_url !== parsed.toString();
    if (changed) {
      delete job.context.sales;
      job.draftHash = null;
      if (job.outreachApproval) this.revokeApproval(job.outreachApproval);
      job.outreachApproval = null;
    }
    job.context.preview = {
      preview_url: parsed.toString(),
      artifact_hash: expectedHash,
      locale: job.context.siteSpec.locale,
    };
    job.externalPreview = {
      verified: true,
      fixtureSimulated: true,
      verifiedAt: now(),
    };
    return this.save(job, job.revision);
  }

  async draftSales(runId: string): Promise<JsonObject> {
    const job = this.show(runId);
    if (
      !job.previewApproval ||
      Date.parse(job.previewApproval.expires_at) <= Date.now() ||
      !job.externalPreview?.verified ||
      job.context.preview?.artifact_hash !== job.artifactHash
    )
      throw new Error("current approved external preview is required");
    if (job.contactPermission?.status !== "approved")
      throw new Error("approved contact permission is required");
    if (!job.context.agency) throw new Error("agency profile is required");
    job.context.offer = job.context.offer ?? this.config.offer;
    job.context.recipient = { salutation: null };
    job.context.approved_improvements = (
      job.context.qa?.resolved_audit_issue_ids ?? []
    ).map((issueId: string) => {
      const issue = job.context.audit.issues.find(
        (x: JsonObject) => x.issue_id === issueId,
      );
      return {
        issue_id: issueId,
        description: issue?.recommendation ?? "Verbesserung umgesetzt",
        evidence_ids: issue?.evidence_ids ?? [],
      };
    });
    const result = await this.agent(job, "sales");
    job.context.sales = result;
    job.draftHash = hash(result);
    job.stage = "outreach_review";
    job.status = "waiting_approval";
    return this.save(job, job.revision);
  }

  setContact(
    runId: string,
    status: "approved" | "unknown" | "blocked",
    reason: string,
  ): JsonObject {
    return this.store.transaction(() => {
      if (!["approved", "unknown", "blocked"].includes(status))
        throw new Error("invalid contact status");
      if (!reason.trim()) throw new Error("contact reason is required");
      const job = this.show(runId);
      const revision = (job.contactPermission?.revision ?? 0) + 1;
      job.contactPermission = validate("ContactPermission", {
        permission_id: id(),
        lead_id: job.leadId,
        recipient_hash: hash(job.context.profile?.contacts ?? []),
        status,
        operator_id: "local-operator",
        recorded_at: now(),
        expires_at: null,
        reason,
        revision,
      });
      if (job.outreachApproval) this.revokeApproval(job.outreachApproval);
      job.outreachApproval = null;
      return this.save(job, job.revision);
    });
  }
  approveOutreach(
    runId: string,
    expectedHash: string,
    expectedRevision?: number,
  ): JsonObject {
    const job = this.show(runId);
    const revision = expectedRevision ?? job.revision;
    if (job.revision !== revision)
      throw new Error("version conflict for outreach approval");
    if (job.stage !== "outreach_review" || job.status !== "waiting_approval")
      throw new Error("outreach is not waiting for approval");
    if (job.contactPermission?.status !== "approved" || !job.previewApproval)
      throw new Error("contact and preview approvals are required");
    if (job.draftHash !== expectedHash)
      throw new Error("draft hash does not match current draft");
    this.assertArtifact(job, job.artifactHash);
    if (Date.parse(job.previewApproval.expires_at) <= Date.now())
      throw new Error("preview approval has expired");
    const approval = validate("Approval", {
      approval_id: id(),
      kind: "outreach",
      operator_id: "local-operator",
      approved_at: now(),
      expires_at: job.previewApproval.expires_at,
      artifact_manifest_hash: job.artifactHash,
      subject_revision: job.revision,
      expected_revision: revision,
      revoked_at: null,
      final_text_hash: expectedHash,
      recipient_hash: job.contactPermission.recipient_hash,
      contact_permission_revision: job.contactPermission.revision,
      preview_approval_id: job.previewApproval.approval_id,
    });
    return this.store.transaction(() => {
      this.store.put("approvals", approval.approval_id, approval);
      job.outreachApproval = approval;
      job.status = "succeeded";
      return this.save(job, job.revision);
    });
  }

  async exportDraft(
    runId: string,
    kind: "internal" | "ready",
  ): Promise<JsonObject> {
    if (!["internal", "ready"].includes(kind))
      throw new Error("invalid export kind");
    const job = this.show(runId);
    if (!job.context.sales) throw new Error("sales draft is required");
    if (kind === "ready") {
      const approval = job.outreachApproval;
      if (!approval || job.contactPermission?.status !== "approved")
        throw new Error("current outreach approval is required");
      this.assertArtifact(job, job.artifactHash);
      if (
        Date.parse(approval.expires_at) <= Date.now() ||
        approval.revoked_at !== null ||
        approval.final_text_hash !== job.draftHash ||
        approval.artifact_manifest_hash !== job.artifactHash ||
        approval.contact_permission_revision !==
          job.contactPermission.revision ||
        approval.recipient_hash !== job.contactPermission.recipient_hash ||
        approval.preview_approval_id !== job.previewApproval?.approval_id ||
        job.context.preview?.artifact_hash !== job.artifactHash
      )
        throw new Error("outreach approval bindings are stale");
    }
    const key = hash({
      kind,
      draft: job.draftHash,
      approval: job.outreachApproval,
      preview: job.context.preview,
    });
    const prior = this.store.get("exports", key);
    if (prior) return prior;
    const dir = join(this.config.dataDir, "exports");
    mkdirSync(dir, { recursive: true });
    const path = join(dir, `${key}.json`);
    const value = {
      kind,
      run_id: runId,
      draft: job.context.sales,
      preview: job.context.preview,
      can_send: false,
      export_ready: kind === "ready",
      exported_at: now(),
    };
    writeFileSync(path, JSON.stringify(value, null, 2));
    const result = { path, hash: key, kind, runId, leadId: job.leadId };
    this.store.put("exports", key, result);
    job.stage = kind === "ready" ? "done" : "export";
    job.status = kind === "ready" ? "done" : "succeeded";
    this.save(job, job.revision);
    return result;
  }
  pause(runId: string): void {
    this.interrupt(runId, "paused");
  }
  cancel(runId: string): void {
    this.interrupt(runId, "cancelled");
  }
  async deleteLead(leadId: string): Promise<void> {
    const jobs = this.store.db
      .prepare("SELECT run_id FROM factory_jobs WHERE lead_id=?")
      .all(leadId) as Array<{ run_id: string }>;
    const runIds = new Set(jobs.map((x) => x.run_id));
    this.store.transaction(() => {
      this.store.put("tombstones", leadId, { leadId, deletedAt: now() });
      for (const index of this.store
        .list("cache_index")
        .filter((item) => item.leadId === leadId)) {
        this.store.db
          .prepare("DELETE FROM records WHERE kind='cache' AND id=?")
          .run(index.cacheKey);
        this.store.db
          .prepare("DELETE FROM records WHERE kind='cache_index' AND id=?")
          .run(index.id);
      }
      const records = this.store.db
        .prepare("SELECT kind,id,value_json FROM records")
        .all() as Array<{ kind: string; id: string; value_json: string }>;
      for (const row of records) {
        if (row.kind === "tombstones" || row.kind === "operations") continue;
        const value = JSON.parse(row.value_json);
        if (
          value.leadId === leadId ||
          value.lead_id === leadId ||
          runIds.has(value.runId) ||
          runIds.has(value.run_id)
        )
          this.store.db
            .prepare("DELETE FROM records WHERE kind=? AND id=?")
            .run(row.kind, row.id);
      }
      this.store.db
        .prepare("DELETE FROM factory_jobs WHERE lead_id=?")
        .run(leadId);
    });
    const root = resolve(this.config.dataDir);
    for (const kind of ["crawl", "artifacts", "tests", ".staging"]) {
      const target =
        kind === ".staging" ? resolve(root, kind) : resolve(root, kind, leadId);
      if (!target.startsWith(`${root}${sep}`))
        throw new Error("refusing to delete outside configured data directory");
      if (kind === ".staging") {
        for (const operation of this.store
          .list("operations")
          .filter((item) => item.leadId === leadId)) {
          await rm(this.safeStagingPath(operation.stagingRoot), {
            recursive: true,
            force: true,
          });
          if (operation.finalPath)
            await rm(this.safePublicationPath(operation.finalPath), {
              recursive: true,
              force: true,
            });
          this.store.db
            .prepare("DELETE FROM records WHERE kind='operations' AND id=?")
            .run(operation.id);
        }
      } else await rm(target, { recursive: true, force: true });
    }
  }

  private async execute(initial: JsonObject): Promise<JsonObject> {
    let job = initial;
    const lease = id();
    job = this.claim(job, lease);
    try {
      if (!job.context.crawl) {
        job.stage = "collect";
        if (this.config.mode === "fixture") {
          job.context.crawl = fixtureInput();
          job = this.save(job, job.revision, lease);
        } else {
          const operation = this.beginOperation(job, "collect");
          let finalDir: string | null = null;
          try {
            const collect =
              this.collector ??
              ((await import("./crawler.js")).collect as Collector);
            const options = {
              outputDir: operation.stagingRoot,
              maxHtmlPagesPerLead: this.config.crawler.maxHtmlPagesPerLead,
              requestTimeoutMs: this.config.crawler.requestTimeoutMs,
              browser: true,
              requestsPerHost: this.config.crawler.requestsPerHost,
              minHostIntervalMs: this.config.crawler.minHostIntervalMs,
              maxRedirects: this.config.crawler.maxRedirects,
              maxPageBytes: this.config.crawler.maxPageBytes,
              maxCrawlBytesPerLead: this.config.crawler.maxCrawlBytesPerLead,
              maxBrowserRequestsPerLead:
                this.config.crawler.maxBrowserRequestsPerLead,
              maxCrawlDurationMs: this.config.crawler.maxCrawlDurationMs,
            };
            const crawled = await collect(job.website, options);
            finalDir = join(
              this.config.dataDir,
              "crawl",
              job.leadId,
              operation.id,
            );
            this.recordPublication(operation.id, finalDir);
            this.store.transaction(() => {
              this.assertWorker(job, lease);
              mkdirSync(join(this.config.dataDir, "crawl", job.leadId), {
                recursive: true,
              });
              renameSync(
                this.safeStagingPath(operation.stagingRoot),
                this.safePublicationPath(finalDir as string),
              );
              job.context.crawl = this.rewritePaths(
                crawled,
                operation.stagingRoot,
                finalDir as string,
              );
              job = this.save(job, job.revision, lease);
            });
            this.finishPublishedOperation(operation.id);
          } catch (error) {
            if (finalDir)
              rmSync(this.safePublicationPath(finalDir), {
                recursive: true,
                force: true,
              });
            this.endOperation(operation.id, operation.stagingRoot);
            throw error;
          }
        }
      }
      if (this.config.mode === "live") {
        const observed = Date.parse(job.context.crawl.observedAt ?? "");
        if (
          !Number.isFinite(observed) ||
          observed + 7 * 24 * 60 * 60 * 1000 <= Date.now()
        ) {
          job.stage = "collect";
          job.status = "needs_input";
          job.reason = "crawl_stale_recrawl_required";
          return this.save(job, job.revision, lease);
        }
      }
      for (const agent of ["scout", "audit", "qualifier"] as AgentName[]) {
        if (!job.context[this.contextKey(agent)]) {
          job.stage = agent;
          job.context[this.contextKey(agent)] = await this.agent(job, agent);
          job = this.save(job, job.revision, lease);
        }
        if (job.stopAfter === agent) {
          job.status = "paused";
          return this.save(job, job.revision, lease);
        }
      }
      const reset = this.resetBlockedDemoApproval(job, job.revision, lease);
      if (reset) return reset;
      if (!job.context.demoReview)
        job.context.demoReview = this.analysisReview(job);
      if (
        (this.config.mode === "live" || job.requireDemoDecision) &&
        !job.context.demoDecision
      ) {
        job.stage = "demo_review";
        job.status = "waiting_approval";
        return this.save(job, job.revision, lease);
      }
      if (this.config.mode === "fixture") {
        if (job.context.qualification.decision === "manual_review") {
          job.stage = "qualifier";
          job.status = "manual_review";
          return this.save(job, job.revision, lease);
        }
        if (job.context.qualification.decision !== "proceed") {
          job.stage = "done";
          job.status = "done";
          return this.save(job, job.revision, lease);
        }
        if (!this.config.autoGenerate && !job.experimental) {
          job.status = "manual_review";
          return this.save(job, job.revision, lease);
        }
      }
      for (const agent of ["strategist", "builder"] as AgentName[]) {
        if (!job.context[this.contextKey(agent)]) {
          job.stage = agent;
          job.context[this.contextKey(agent)] = await this.agent(job, agent);
          job = this.save(job, job.revision, lease);
        }
        if (job.stopAfter === agent) {
          job.status = "paused";
          return this.save(job, job.revision, lease);
        }
      }
      if (!job.context.render) {
        job.stage = "render";
        const key = hash({
          kind: "render",
          leadId: job.leadId,
          siteSpec: job.context.siteSpec,
          profile: job.context.profile,
          assets: job.context.approvedAssets ?? [],
          mode: this.config.mode,
        });
        const cached = this.cached(key);
        if (cached) {
          job.context.render = cached;
          job.cacheHits++;
          job.artifactHash = job.context.render.hash;
          job = this.save(job, job.revision, lease);
        } else {
          const operation = this.beginOperation(job, "render");
          let finalDir: string | null = null;
          try {
            const rendered = await this.renderer({
              siteSpec: job.context.siteSpec,
              profile: job.context.profile,
              assets: job.context.approvedAssets ?? [],
              outputDir: operation.stagingRoot,
              mode: this.config.mode as "fixture" | "live",
              leadId: job.leadId,
            });
            finalDir = join(
              this.config.dataDir,
              "artifacts",
              job.leadId,
              `artifact-${rendered.manifest.manifest_id}`,
            );
            this.recordPublication(operation.id, finalDir);
            this.store.transaction(() => {
              this.assertWorker(job, lease);
              mkdirSync(join(this.config.dataDir, "artifacts", job.leadId), {
                recursive: true,
              });
              renameSync(
                this.safeStagingPath(rendered.artifactDir),
                this.safePublicationPath(finalDir as string),
              );
              job.context.render = { ...rendered, artifactDir: finalDir };
              job.artifactHash = rendered.hash;
              this.putCache(key, job.context.render, job.leadId);
              job = this.save(job, job.revision, lease);
            });
            this.endOperation(operation.id, operation.stagingRoot);
          } catch (error) {
            if (finalDir)
              rmSync(this.safePublicationPath(finalDir), {
                recursive: true,
                force: true,
              });
            this.endOperation(operation.id, operation.stagingRoot);
            throw error;
          }
        }
      }
      if (!job.context.browser) {
        job.stage = "test";
        const key = hash({
          kind: "browser",
          leadId: job.leadId,
          artifact: job.artifactHash,
          siteSpec: job.context.siteSpec,
        });
        const cached = this.cached(key);
        if (cached) {
          job.context.browser = cached;
          job.cacheHits++;
          job = this.save(job, job.revision, lease);
        } else {
          const operation = this.beginOperation(job, "browser");
          let finalDir: string | null = null;
          try {
            const stagedOutput = join(operation.stagingRoot, "screenshots");
            const checked = await this.browserRunner({
              artifactDir: job.context.render.artifactDir,
              siteSpec: job.context.siteSpec,
              profile: job.context.profile,
              outputDir: stagedOutput,
            });
            finalDir = join(
              this.config.dataDir,
              "tests",
              job.leadId,
              operation.id,
            );
            this.recordPublication(operation.id, finalDir);
            this.store.transaction(() => {
              this.assertWorker(job, lease);
              mkdirSync(join(this.config.dataDir, "tests", job.leadId), {
                recursive: true,
              });
              renameSync(
                this.safeStagingPath(stagedOutput),
                this.safePublicationPath(finalDir as string),
              );
              job.context.browser = this.rewritePaths(
                checked,
                stagedOutput,
                finalDir as string,
              );
              this.putCache(key, job.context.browser, job.leadId);
              job = this.save(job, job.revision, lease);
            });
            this.endOperation(operation.id, operation.stagingRoot);
          } catch (error) {
            if (finalDir)
              rmSync(this.safePublicationPath(finalDir), {
                recursive: true,
                force: true,
              });
            this.endOperation(operation.id, operation.stagingRoot);
            throw error;
          }
        }
      }
      if (!job.context.qa) {
        job.stage = "qa";
        job.context.qa = await this.agent(job, "qa");
        job = this.save(job, job.revision, lease);
      }
      if (job.context.qa.decision !== "pass") {
        const tasks =
          job.context.qa.decision === "fail" ? this.siteRepairTasks(job) : [];
        if (
          tasks.length &&
          (job.repairRounds ?? 0) < this.config.limits.maxSiteRepairs
        ) {
          job.context.repairHistory = [
            ...(job.context.repairHistory ?? []),
            {
              round: (job.repairRounds ?? 0) + 1,
              siteSpecHash: hash(job.context.siteSpec),
              qaHash: hash(job.context.qa),
              tasks,
            },
          ];
          job.context.previousSiteSpec = job.context.siteSpec;
          job.context.repairTasks = tasks;
          for (const key of ["siteSpec", "render", "browser", "qa"])
            delete job.context[key];
          job.repairRounds = (job.repairRounds ?? 0) + 1;
          job.artifactHash = null;
          this.revokeApprovals(job);
          job.stage = "builder";
          job.status = "queued";
          job = this.save(job, job.revision, lease);
          return this.execute(job);
        }
        job.status =
          job.context.qa.decision === "needs_input"
            ? "needs_input"
            : "manual_review";
        return this.save(job, job.revision, lease);
      }
      delete job.context.repairTasks;
      delete job.context.previousSiteSpec;
      job.stage = "preview_review";
      job.status = "waiting_approval";
      return this.save(job, job.revision, lease);
    } catch (error) {
      job = this.show(job.id);
      if (job.status === "paused" || job.status === "cancelled") return job;
      job.status = "failed";
      job.error = error instanceof Error ? error.message : String(error);
      this.save(job, job.revision, lease);
      throw error;
    }
  }

  private async agent(job: JsonObject, agent: AgentName): Promise<JsonObject> {
    const input = buildAgentInput(agent, job.context);
    const inputHash = hash(input);
    const root = `${agent === "qa" ? "QA" : agent[0].toUpperCase() + agent.slice(1)}Output`;
    const key = hash({
      agent,
      leadId: job.leadId,
      input,
      schema: schemaFor(root),
      prompt: promptFor(agent),
      model: this.config.models[agent],
      policy: { mode: this.config.mode, limits: this.config.limits },
    });
    const cached = this.cached(key);
    if (cached) {
      job.cacheHits++;
      return cached;
    }
    const logical = this.logicalStep(job, agent, inputHash);
    const stepId = logical.stepId as string;
    const images = (input.images ?? []).map((x: JsonObject) => ({
      path: x.attachment_ref,
      evidence_id: x.evidence_id,
    }));
    const prior = this.store
      .list("agent_raw_outputs")
      .filter((item) => item.logicalKey === logical.logicalKey)
      .sort(
        (a, b) =>
          Number(a.sequence ?? 0) - Number(b.sequence ?? 0) ||
          String(a.createdAt).localeCompare(String(b.createdAt)),
      )
      .at(-1);
    let priorReason: string | null = null;
    if (prior) {
      try {
        const result = processAgentOutput(agent, prior.raw, input);
        this.recordSemantic(job, prior, "accepted", null);
        this.publishAgentResult(job, agent, stepId, key, result);
        return result;
      } catch (error) {
        priorReason = this.errorMessage(error);
        this.recordSemantic(job, prior, "rejected", priorReason);
      }
    } else if (
      !this.agentOutput &&
      this.config.mode === "live" &&
      this.store.countDispatches(stepId) >= this.config.limits.maxDispatches
    ) {
      throw new Error(
        "The logical step has exhausted its dispatch allowance and no historical raw output is available",
      );
    }
    let phase = "initial";
    let raw: JsonObject;
    try {
      raw = this.agentOutput
        ? await this.agentOutput(agent, input, job)
        : this.config.mode === "fixture"
          ? fixtureOutput(agent, input)
          : await this.provider!.invoke({
              agent,
              input,
              runId: job.id,
              leadId: job.leadId,
              stepId,
              images,
            });
    } catch (dispatchError) {
      if (!priorReason) throw dispatchError;
      throw new Error(
        `Semantic validation failed: ${priorReason}; dispatch failed: ${this.errorMessage(dispatchError)}`,
        { cause: dispatchError },
      );
    }
    let diagnostic = this.persistRaw(job, agent, logical, raw, phase);
    let result: JsonObject;
    try {
      result = processAgentOutput(agent, raw, input);
      this.recordSemantic(job, diagnostic, "accepted", null);
    } catch (error) {
      const reason = this.errorMessage(error);
      this.recordSemantic(job, diagnostic, "rejected", reason);
      if (this.config.mode === "fixture" || this.agentOutput) throw error;
      try {
        raw = await this.provider!.invoke({
          agent,
          input,
          runId: job.id,
          leadId: job.leadId,
          stepId,
          repair: { reason },
          images,
        });
      } catch (repairDispatchError) {
        throw new Error(
          `Semantic validation failed: ${reason}; repair dispatch failed: ${this.errorMessage(repairDispatchError)}`,
          { cause: repairDispatchError },
        );
      }
      phase = "semantic_repair";
      diagnostic = this.persistRaw(job, agent, logical, raw, phase);
      try {
        result = processAgentOutput(agent, raw, input);
        this.recordSemantic(job, diagnostic, "accepted", null);
      } catch (repairError) {
        const message = this.errorMessage(repairError);
        this.recordSemantic(job, diagnostic, "rejected", message);
        const upgrade = this.upgradeFor(agent);
        if (
          !upgrade ||
          /(evidence|image|reference|missing|budget|country|asset|contact)/i.test(
            message,
          )
        )
          throw repairError;
        try {
          raw = await this.provider!.invoke({
            agent,
            input,
            runId: job.id,
            leadId: job.leadId,
            stepId,
            modelOverride: upgrade,
            images,
          });
        } catch (upgradeError) {
          throw new Error(
            `Semantic validation failed: ${message}; upgrade dispatch failed: ${this.errorMessage(upgradeError)}`,
            { cause: upgradeError },
          );
        }
        diagnostic = this.persistRaw(job, agent, logical, raw, "upgrade");
        try {
          result = processAgentOutput(agent, raw, input);
          this.recordSemantic(job, diagnostic, "accepted", null);
        } catch (upgradeSemanticError) {
          this.recordSemantic(
            job,
            diagnostic,
            "rejected",
            this.errorMessage(upgradeSemanticError),
          );
          throw upgradeSemanticError;
        }
      }
    }
    this.publishAgentResult(job, agent, stepId, key, result);
    return result;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private logicalStep(
    job: JsonObject,
    agent: AgentName,
    inputHash: string,
  ): JsonObject {
    const logicalKey = hash({ runId: job.id, agent, inputHash });
    const existing = this.store.get("logical_steps", logicalKey);
    if (existing) return existing;
    return this.store.transaction(() => {
      this.assertPublishable(job);
      const raced = this.store.get("logical_steps", logicalKey);
      if (raced) return raced;
      const siblings = this.store
        .list("logical_steps")
        .filter((item) => item.runId === job.id && item.agent === agent);
      let stepId = `step-${logicalKey.slice(0, 24)}`;
      let migratedLegacy = false;
      if (!siblings.length) {
        const legacy = this.store.db
          .prepare(
            "SELECT DISTINCT step_id FROM agent_attempts WHERE run_id=? AND lead_id=? AND agent=? ORDER BY step_id",
          )
          .all(job.id, job.leadId, agent) as Array<{ step_id: string }>;
        if (legacy.length > 1)
          throw new Error("ambiguous legacy logical step identity");
        if (legacy.length === 1) {
          stepId = legacy[0].step_id;
          migratedLegacy = true;
        }
      }
      const value = {
        logicalKey,
        runId: job.id,
        leadId: job.leadId,
        agent,
        inputHash,
        stepId,
        migratedLegacy,
        createdAt: now(),
      };
      this.store.put("logical_steps", logicalKey, value);
      return value;
    });
  }

  private persistRaw(
    job: JsonObject,
    agent: AgentName,
    logical: JsonObject,
    raw: JsonObject,
    phase: string,
  ): JsonObject {
    const root = `${agent === "qa" ? "QA" : agent[0].toUpperCase() + agent.slice(1)}Output`;
    validate(root, raw);
    const rawId = id();
    const sequence =
      this.store
        .list("agent_raw_outputs")
        .filter((item) => item.logicalKey === logical.logicalKey).length + 1;
    const record = {
      rawId,
      runId: job.id,
      leadId: job.leadId,
      agent,
      logicalKey: logical.logicalKey,
      stepId: logical.stepId,
      inputHash: logical.inputHash,
      phase,
      sequence,
      raw,
      rawHash: hash(raw),
      semanticStatus: "pending",
      semanticError: null,
      createdAt: now(),
    };
    this.store.transaction(() => {
      this.assertPublishable(job);
      this.store.put("agent_raw_outputs", rawId, record);
    });
    return record;
  }

  private recordSemantic(
    job: JsonObject,
    record: JsonObject,
    status: "accepted" | "rejected",
    error: string | null,
  ): void {
    this.store.transaction(() => {
      this.assertPublishable(job);
      this.store.put("agent_raw_outputs", record.rawId, {
        ...record,
        semanticStatus: status,
        semanticError: error,
        validatedAt: now(),
      });
    });
  }

  private publishAgentResult(
    job: JsonObject,
    agent: AgentName,
    stepId: string,
    key: string,
    result: JsonObject,
  ): void {
    this.store.transaction(() => {
      this.assertPublishable(job);
      this.putCache(key, result, job.leadId);
      this.store.put("steps", `${job.id}:${agent}`, {
        runId: job.id,
        leadId: job.leadId,
        agent,
        stepId,
        stepKey: key,
        status: "succeeded",
        mode: this.config.mode,
        outputHash: hash(result),
        completedAt: now(),
      });
    });
  }
  private siteRepairTasks(job: JsonObject): JsonObject[] {
    const pages = job.context.siteSpec.pages as JsonObject[];
    const blocked =
      /\b(?:renderer|infrastructure|missing input|missing image|refusal|auth(?:entication|orization)?)\b/i;
    const tasks: JsonObject[] = [];
    for (const issue of job.context.qa.issues as JsonObject[]) {
      if (
        issue.suggested_fix_target !== "site_spec" ||
        blocked.test(`${issue.observation} ${issue.recommendation}`) ||
        ["performance", "preview_safety"].includes(issue.category)
      )
        continue;
      const pageIndex = pages.findIndex(
        (page) => page.route === issue.page_ref,
      );
      if (pageIndex < 0 || !issue.evidence_ids.length) continue;
      const page = pages[pageIndex];
      let allowed: string[] = [];
      if (["mobile_usability", "conversion"].includes(issue.category))
        allowed = page.sections.map(
          (_: JsonObject, index: number) =>
            `/pages/${pageIndex}/sections/${index}/cta`,
        );
      else if (issue.category === "technical_seo")
        allowed = [
          `/pages/${pageIndex}/title`,
          `/pages/${pageIndex}/meta_description`,
        ];
      else if (
        ["content_clarity", "trust_transparency", "factual"].includes(
          issue.category,
        )
      ) {
        allowed = [
          `/pages/${pageIndex}/title`,
          `/pages/${pageIndex}/meta_description`,
          ...page.sections.flatMap((_: JsonObject, index: number) => [
            `/pages/${pageIndex}/sections/${index}/heading`,
            `/pages/${pageIndex}/sections/${index}/body`,
            `/pages/${pageIndex}/sections/${index}/items`,
          ]),
        ];
      }
      if (allowed.length)
        tasks.push(
          validate("RepairTask", {
            issue_id: issue.issue_id,
            allowed_paths: allowed,
            expected_effect: issue.recommendation,
          }),
        );
    }
    return tasks;
  }
  private analysisReview(job: JsonObject): JsonObject {
    const profile = job.context.profile;
    const audit = job.context.audit;
    const qualification = job.context.qualification;
    const currentFact = (field: string, expected?: string) =>
      (profile.facts ?? []).some(
        (fact: JsonObject) =>
          fact.field === field &&
          fact.value &&
          (expected === undefined || fact.value === expected) &&
          fact.verification !== "conflicting" &&
          (!fact.valid_until || Date.parse(fact.valid_until) > Date.now()),
      );
    const blockers: string[] = [];
    if (job.mode === "live") {
      const blocker = businessBlocker(job.context.businessReview);
      if (blocker) blockers.push(blocker);
    }
    if (!currentFact("company_name")) blockers.push("company_identity_missing");
    const groundedSwissCountry = (profile.facts ?? []).some(
      (fact: JsonObject) =>
        fact.field === "country" &&
        ["ch", "schweiz", "suisse", "svizzera", "switzerland"].includes(
          String(fact.value ?? "").toLocaleLowerCase(),
        ) &&
        fact.verification !== "conflicting" &&
        (!fact.valid_until || Date.parse(fact.valid_until) > Date.now()),
    );
    if (!groundedSwissCountry) blockers.push("ch_location_missing");
    if (
      (profile.contradictions ?? []).some(
        (item: JsonObject) => item.reason === "conflicting",
      )
    )
      blockers.push("conflicting_source_facts");
    if (audit.quality_score === null || audit.quality_score === undefined)
      blockers.push("audit_coverage_insufficient");
    if (qualification.offer_fit !== 100)
      blockers.push("offer_fit_not_supported");
    if (qualification.implementation_fit !== 100)
      blockers.push("implementation_fit_not_supported");
    if ((qualification.reason_codes ?? []).includes("reject"))
      blockers.push("hard_exclusion");
    const summary = {
      website: job.website,
      businessStatus: job.context.businessReview ?? {
        status: "uncertain",
        verification: "not_reviewed",
      },
      audit: {
        qualityScore: audit.quality_score,
        coverage: audit.coverage,
        dimensions: Object.fromEntries(
          Object.entries(audit.dimensions).map(([name, dimension]) => [
            name,
            (dimension as JsonObject).level,
          ]),
        ),
        issues: (audit.issues ?? []).map((issue: JsonObject) => ({
          issueId: issue.issue_id,
          severity: issue.severity,
          category: issue.category,
          observation: issue.observation,
          recommendation: issue.recommendation,
          suggestedFixTarget: issue.suggested_fix_target,
        })),
      },
      qualification: {
        decision: qualification.decision,
        priority: qualification.priority,
        score: qualification.opportunity_score,
        lowerBound: qualification.lower_bound,
        upperBound: qualification.upper_bound,
        coverage: qualification.coverage,
        uncertain:
          qualification.opportunity_score === null ||
          qualification.coverage < 1 ||
          qualification.decision === "manual_review",
        reasonCodes: qualification.reason_codes,
      },
      eligibility: {
        canApprove: blockers.length === 0,
        blockers,
        limitation:
          "Approval overrides ranking only; it does not supply missing facts or waive implementation and safety constraints.",
      },
      sourceHashes: {
        profile: hash(profile),
        audit: hash(audit),
        qualification: hash(qualification),
        offer: hash(job.context.offer),
        campaign: hash(job.context.campaign),
        template: hash(job.context.template),
      },
    };
    return { reviewHash: hash(summary), summary };
  }
  private resetBlockedDemoApproval(
    job: JsonObject,
    expectedRevision: number,
    lease?: string,
  ): JsonObject | null {
    if (
      this.config.mode !== "live" ||
      job.context.demoDecision?.decision !== "approve"
    )
      return null;
    const blocker = businessBlocker(job.context.businessReview);
    if (!blocker) return null;
    return this.store.transaction(() => {
      const decision = job.context.demoDecision;
      this.store.put("demo_decisions", decision.decisionId, {
        ...decision,
        revokedAt: now(),
        revokedReason: blocker,
      });
      delete job.context.demoDecision;
      job.context.demoReview = this.analysisReview(job);
      job.stage = "demo_review";
      job.status = "waiting_approval";
      job.reason = blocker;
      job.stopAfter = null;
      return this.save(job, expectedRevision, lease);
    });
  }
  private contextKey(agent: AgentName): string {
    return (
      {
        scout: "profile",
        audit: "audit",
        qualifier: "qualification",
        strategist: "brief",
        builder: "siteSpec",
        qa: "qa",
        sales: "sales",
      } as Record<AgentName, string>
    )[agent];
  }
  private revokeApproval(approval: JsonObject): void {
    const approvalId = approval.approval_id;
    const current = this.store.get("approvals", approvalId);
    if (current) {
      delete current.id;
      current.revoked_at = now();
      this.store.put("approvals", approvalId, current);
    }
  }
  private revokeApprovals(job: JsonObject): void {
    if (job.previewApproval) this.revokeApproval(job.previewApproval);
    if (job.outreachApproval) this.revokeApproval(job.outreachApproval);
    job.previewApproval = null;
    job.outreachApproval = null;
  }
  private upgradeFor(agent: AgentName): string | null {
    if (!this.config.escalation.enabled) return null;
    const model = this.config.models[agent].model;
    if (model === "gpt-5.6-luna") return "gpt-5.6-terra";
    if (
      model === "gpt-5.6-terra" &&
      (["audit", "strategist", "qa"] as AgentName[]).includes(agent)
    )
      return "gpt-5.6-sol";
    return null;
  }
  private cached(key: string): JsonObject | null {
    const value = this.store.get("cache", key);
    if (!value) return null;
    const result = { ...value };
    delete result.id;
    return result;
  }
  private putCache(key: string, value: JsonObject, leadId: string): void {
    this.store.transaction(() => {
      this.store.put("cache", key, value);
      this.store.put("cache_index", key, { cacheKey: key, leadId });
    });
  }
  private beginOperation(
    job: JsonObject,
    kind: "collect" | "render" | "browser",
  ): { id: string; stagingRoot: string } {
    const operationId = `${kind}-${id()}`;
    const stagingRoot = this.safeStagingPath(
      join(this.config.dataDir, ".staging", operationId),
    );
    mkdirSync(stagingRoot, { recursive: true });
    this.store.put("operations", operationId, {
      operationId,
      runId: job.id,
      leadId: job.leadId,
      kind,
      stagingRoot,
      leaseOwner: this.row(job.id)?.lease_owner,
      fencingToken: job.fencingToken,
      createdAt: now(),
      finalPath: null,
    });
    return { id: operationId, stagingRoot };
  }
  private recordPublication(operationId: string, finalPath: string): void {
    const operation = this.store.get("operations", operationId);
    if (!operation) throw new Error("staging operation disappeared");
    delete operation.id;
    this.store.put("operations", operationId, {
      ...operation,
      finalPath: this.safePublicationPath(finalPath),
    });
  }
  private endOperation(operationId: string, stagingRoot: string): void {
    rmSync(this.safeStagingPath(stagingRoot), { recursive: true, force: true });
    this.store.db
      .prepare("DELETE FROM records WHERE kind='operations' AND id=?")
      .run(operationId);
  }
  private finishPublishedOperation(operationId: string): void {
    this.store.db
      .prepare("DELETE FROM records WHERE kind='operations' AND id=?")
      .run(operationId);
  }
  private safeStagingPath(path: string): string {
    const stagingRoot = resolve(this.config.dataDir, ".staging");
    const target = resolve(path);
    if (!target.startsWith(`${stagingRoot}${sep}`))
      throw new Error(
        "refusing staging operation outside configured data directory",
      );
    return target;
  }
  private safePublicationPath(path: string): string {
    const target = resolve(path);
    const allowed = ["crawl", "artifacts", "tests"].some((kind) =>
      target.startsWith(`${resolve(this.config.dataDir, kind)}${sep}`),
    );
    if (!allowed)
      throw new Error(
        "refusing publication outside configured artifact directories",
      );
    return target;
  }
  private rewritePaths<T>(value: T, from: string, to: string): T {
    if (typeof value === "string")
      return value
        .replaceAll(resolve(from), resolve(to))
        .replaceAll(from, to) as T;
    if (Array.isArray(value))
      return value.map((item) => this.rewritePaths(item, from, to)) as T;
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value as JsonObject).map(([key, item]) => [
          key,
          this.rewritePaths(item, from, to),
        ]),
      ) as T;
    return value;
  }
  private cleanupOrphans(): void {
    for (const operation of this.store.list("operations")) {
      const row = this.row(operation.runId);
      const active =
        row &&
        row.status === "running" &&
        row.lease_owner === operation.leaseOwner &&
        row.fencing_token === operation.fencingToken &&
        Date.parse(row.lease_expires_at ?? "") > Date.now();
      if (!active) {
        rmSync(this.safeStagingPath(operation.stagingRoot), {
          recursive: true,
          force: true,
        });
        if (operation.finalPath)
          rmSync(this.safePublicationPath(operation.finalPath), {
            recursive: true,
            force: true,
          });
        this.store.db
          .prepare("DELETE FROM records WHERE kind='operations' AND id=?")
          .run(operation.id);
      }
    }
  }
  private cleanupTombstones(): void {
    const root = resolve(this.config.dataDir);
    for (const tombstone of this.store.list("tombstones"))
      for (const kind of ["crawl", "artifacts", "tests"]) {
        const target = resolve(root, kind, tombstone.leadId);
        if (target.startsWith(`${root}${sep}`))
          rmSync(target, { recursive: true, force: true });
      }
  }
  private assertWorker(job: JsonObject, lease?: string): void {
    const row = this.row(job.id);
    if (
      !row ||
      row.revision !== job.revision ||
      row.fencing_token !== job.fencingToken ||
      (lease !== undefined && row.lease_owner !== lease)
    )
      throw new Error("worker was superseded");
  }
  private assertPublishable(job: JsonObject): void {
    this.assertWorker(job);
    if (this.store.get("tombstones", job.leadId))
      throw new Error("worker was superseded by lead deletion");
  }
  private assertArtifact(job: JsonObject, expectedHash: string): void {
    if (!expectedHash || job.artifactHash !== expectedHash)
      throw new Error("artifact hash does not match current preview");
    verifyArtifact({
      artifactDir: resolve(job.context.render.artifactDir),
      expectedHash,
    });
  }
  private row(runId: string): any {
    return this.store.db
      .prepare("SELECT * FROM factory_jobs WHERE run_id=?")
      .get(runId);
  }
  private interrupt(runId: string, status: "paused" | "cancelled"): void {
    const job = this.show(runId);
    if (job.status === "done" || job.status === "cancelled")
      throw new Error(
        `cannot ${status === "paused" ? "pause" : "cancel"} ${job.status} job`,
      );
    job.status = status;
    const revision = job.revision + 1;
    const serialized = { ...job, revision };
    const result = this.store.db
      .prepare(
        "UPDATE factory_jobs SET revision=?,status=?,value_json=?,lease_owner=NULL,lease_expires_at=NULL,fencing_token=fencing_token+1,updated_at=CURRENT_TIMESTAMP WHERE run_id=? AND revision=?",
      )
      .run(revision, status, JSON.stringify(serialized), runId, job.revision);
    if (result.changes !== 1)
      throw new Error("version conflict while interrupting job");
  }
  private claim(job: JsonObject, owner: string): JsonObject {
    const expires = new Date(Date.now() + 5 * 60_000).toISOString();
    const result = this.store.db
      .prepare(
        "UPDATE factory_jobs SET status='running',lease_owner=?,lease_expires_at=?,fencing_token=fencing_token+1,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE run_id=? AND revision=? AND (status!='running' OR lease_expires_at IS NULL OR lease_expires_at<?)",
      )
      .run(owner, expires, job.id, job.revision, now());
    if (result.changes !== 1)
      throw new Error("job is already running or revision changed");
    return this.show(job.id);
  }
  private save(job: JsonObject, expected: number, lease?: string): JsonObject {
    job.updatedAt = now();
    const revision = expected + 1;
    const serialized = { ...job, revision };
    const sql = lease
      ? "UPDATE factory_jobs SET revision=?,stage=?,status=?,value_json=?,updated_at=CURRENT_TIMESTAMP WHERE run_id=? AND revision=? AND lease_owner=? AND fencing_token=?"
      : "UPDATE factory_jobs SET revision=?,stage=?,status=?,value_json=?,updated_at=CURRENT_TIMESTAMP WHERE run_id=? AND revision=?";
    const args = lease
      ? [
          revision,
          job.stage,
          job.status,
          JSON.stringify(serialized),
          job.id,
          expected,
          lease,
          job.fencingToken,
        ]
      : [
          revision,
          job.stage,
          job.status,
          JSON.stringify(serialized),
          job.id,
          expected,
        ];
    const result = this.store.db.prepare(sql).run(...args);
    if (result.changes !== 1)
      throw new Error("version conflict while saving job");
    this.store.put("factory_events", `${job.id}:${revision}`, {
      runId: job.id,
      leadId: job.leadId,
      revision,
      stage: job.stage,
      status: job.status,
      reason: job.reason ?? null,
      createdAt: job.updatedAt,
    });
    return this.show(job.id);
  }
}
