import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { AgentName, JsonObject } from "./contracts.js";

export class BudgetExceededError extends Error {
  readonly code = "BUDGET_EXCEEDED";
  constructor(
    readonly scope: "total" | "day" | "run" | "lead",
    readonly availableMicroUsd: number,
    readonly requestedMicroUsd: number,
  ) {
    super(
      `${scope} budget has ${availableMicroUsd} micro-USD available; ${requestedMicroUsd} requested`,
    );
    this.name = "BudgetExceededError";
  }
}

export interface BudgetLimits {
  runMicroUsd: number;
  leadMicroUsd: number;
  dayMicroUsd: number;
  totalMicroUsd?: number;
}
export interface ReserveBudgetArgs {
  reservationId: string;
  attemptId: string;
  runId: string;
  leadId: string;
  dayKey?: string;
  spendScopeId?: string;
  amountMicroUsd: number;
  limits: BudgetLimits;
}
export interface BudgetStatus {
  limitMicroUsd: number | null;
  settledMicroUsd: number;
  reservedMicroUsd: number;
  uncertainMicroUsd: number;
  availableMicroUsd: number | null;
  blocked: boolean;
}
export interface AttemptInput {
  attemptId: string;
  stepId: string;
  runId: string;
  leadId: string;
  agent: AgentName;
  model: string;
  kind: "initial" | "transient_retry" | "output_repair" | "upgrade" | "doctor";
  reasoning?: "low" | "medium";
  provider?: "openai" | "anthropic";
  inputLimit?: number;
  outputLimit?: number;
  priceVersion?: string;
}

const statesHeld = "'reserved','dispatched','uncertain'";

export class Store {
  readonly db: DatabaseSync;
  private transactionDepth = 0;

  constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true });
    this.db = new DatabaseSync(join(dataDir, "factory.sqlite"));
    this.db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
    );
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS records (
        kind TEXT NOT NULL, id TEXT NOT NULL, value_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(kind,id)
      );
      CREATE TABLE IF NOT EXISTS budget_accounts (
        scope_type TEXT NOT NULL CHECK(scope_type IN ('total','day','run','lead')),
        scope_id TEXT NOT NULL, limit_micro_usd INTEGER NOT NULL CHECK(limit_micro_usd > 0),
        blocked INTEGER NOT NULL DEFAULT 0 CHECK(blocked IN (0,1)),
        PRIMARY KEY(scope_type,scope_id)
      );
      CREATE TABLE IF NOT EXISTS run_spend_scopes (
        run_id TEXT PRIMARY KEY, spend_scope_id TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS agent_attempts (
        attempt_id TEXT PRIMARY KEY, step_id TEXT NOT NULL, run_id TEXT NOT NULL, lead_id TEXT NOT NULL,
        agent TEXT NOT NULL, provider TEXT, requested_model TEXT NOT NULL, reported_model TEXT,
        reasoning TEXT, kind TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'created', price_version TEXT,
        input_limit INTEGER, output_limit INTEGER, request_id TEXT, raw_usage_json TEXT,
        normalized_usage_json TEXT, actual_cost_micro_usd INTEGER, reserved_cost_micro_usd INTEGER,
        billing_status TEXT, latency_ms INTEGER, error_type TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS agent_attempts_step_dispatch ON agent_attempts(step_id,state);
      CREATE TABLE IF NOT EXISTS budget_reservations (
        reservation_id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL UNIQUE,
        spend_scope_id TEXT, day_key TEXT NOT NULL, run_id TEXT NOT NULL, lead_id TEXT NOT NULL,
        amount_micro_usd INTEGER NOT NULL CHECK(amount_micro_usd > 0),
        actual_cost_micro_usd INTEGER, state TEXT NOT NULL CHECK(state IN ('reserved','dispatched','settled','uncertain','released')),
        uncertainty_reason TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS budget_reservations_day ON budget_reservations(day_key,state);
      CREATE INDEX IF NOT EXISTS budget_reservations_total ON budget_reservations(spend_scope_id,state);
      CREATE INDEX IF NOT EXISTS budget_reservations_run ON budget_reservations(run_id,state);
      CREATE INDEX IF NOT EXISTS budget_reservations_lead ON budget_reservations(lead_id,state);
      CREATE TABLE IF NOT EXISTS usage_ledger (
        reservation_id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL, actual_cost_micro_usd INTEGER,
        raw_usage_json TEXT, normalized_usage_json TEXT, billing_status TEXT NOT NULL,
        recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  close(): void {
    this.db.close();
  }

  transaction<T>(fn: () => T): T {
    if (this.transactionDepth > 0) return fn();
    this.db.exec("BEGIN IMMEDIATE");
    this.transactionDepth++;
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    } finally {
      this.transactionDepth--;
    }
  }

  get(kind: string, id: string): any | null {
    const row = this.db
      .prepare("SELECT value_json FROM records WHERE kind=? AND id=?")
      .get(kind, id) as { value_json: string } | undefined;
    return row ? { id, ...JSON.parse(row.value_json) } : null;
  }

  put(kind: string, id: string, value: unknown): void {
    const json = JSON.stringify(value);
    if (json === undefined)
      throw new TypeError("Store values must be JSON serializable");
    this.transaction(() =>
      this.db
        .prepare(
          `
      INSERT INTO records(kind,id,value_json) VALUES(?,?,?)
      ON CONFLICT(kind,id) DO UPDATE SET value_json=excluded.value_json,updated_at=CURRENT_TIMESTAMP
    `,
        )
        .run(kind, id, json),
    );
  }

  list(kind: string): any[] {
    return (
      this.db
        .prepare(
          "SELECT id,value_json FROM records WHERE kind=? ORDER BY created_at,id",
        )
        .all(kind) as Array<{ id: string; value_json: string }>
    ).map((row) => ({ id: row.id, ...JSON.parse(row.value_json) }));
  }

  createAttempt(input: AttemptInput): void {
    this.db
      .prepare(
        `INSERT INTO agent_attempts(
      attempt_id,step_id,run_id,lead_id,agent,provider,requested_model,reasoning,kind,price_version,input_limit,output_limit
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        input.attemptId,
        input.stepId,
        input.runId,
        input.leadId,
        input.agent,
        input.provider ?? null,
        input.model,
        input.reasoning ?? null,
        input.kind,
        input.priceVersion ?? null,
        input.inputLimit ?? null,
        input.outputLimit ?? null,
      );
  }

  getAttempt(attemptId: string): JsonObject | null {
    const row = this.db
      .prepare("SELECT * FROM agent_attempts WHERE attempt_id=?")
      .get(attemptId) as Record<string, unknown> | undefined;
    return row ? this.attemptRow(row) : null;
  }

  private attemptRow(row: Record<string, unknown>): JsonObject {
    return {
      attemptId: row.attempt_id,
      stepId: row.step_id,
      runId: row.run_id,
      leadId: row.lead_id,
      agent: row.agent,
      provider: row.provider,
      model: row.requested_model,
      reportedModel: row.reported_model,
      reasoning: row.reasoning,
      kind: row.kind,
      state: row.state,
      priceVersion: row.price_version,
      inputLimit: row.input_limit,
      outputLimit: row.output_limit,
      requestId: row.request_id,
      rawUsage: row.raw_usage_json
        ? JSON.parse(row.raw_usage_json as string)
        : null,
      normalizedUsage: row.normalized_usage_json
        ? JSON.parse(row.normalized_usage_json as string)
        : null,
      actualCostMicroUsd: row.actual_cost_micro_usd,
      reservedCostMicroUsd: row.reserved_cost_micro_usd,
      billingStatus: row.billing_status,
      latencyMs: row.latency_ms,
      errorType: row.error_type,
    };
  }

  updateAttempt(attemptId: string, patch: JsonObject): void {
    const columns: Record<string, string> = {
      state: "state",
      reportedModel: "reported_model",
      requestId: "request_id",
      rawUsage: "raw_usage_json",
      normalizedUsage: "normalized_usage_json",
      actualCostMicroUsd: "actual_cost_micro_usd",
      reservedCostMicroUsd: "reserved_cost_micro_usd",
      billingStatus: "billing_status",
      latencyMs: "latency_ms",
      errorType: "error_type",
    };
    const entries = Object.entries(patch).filter(([key]) => columns[key]);
    if (!entries.length) return;
    const values = entries.map(([key, value]) =>
      key === "rawUsage" || key === "normalizedUsage"
        ? JSON.stringify(value)
        : value,
    );
    const result = this.db
      .prepare(
        `UPDATE agent_attempts SET ${entries.map(([key]) => `${columns[key]}=?`).join(",")},updated_at=CURRENT_TIMESTAMP WHERE attempt_id=?`,
      )
      .run(...values, attemptId);
    if (result.changes !== 1) throw new Error(`Unknown attempt ${attemptId}`);
  }

  countDispatches(stepId: string): number {
    const row = this.db
      .prepare(
        "SELECT COUNT(*) AS count FROM agent_attempts WHERE step_id=? AND state IN ('dispatched','succeeded','failed','uncertain','blocked')",
      )
      .get(stepId) as { count: number };
    return row.count;
  }

  reserveBudget(args: ReserveBudgetArgs): JsonObject {
    if (!Number.isSafeInteger(args.amountMicroUsd) || args.amountMicroUsd <= 0)
      throw new TypeError("amountMicroUsd must be a positive integer");
    for (const [name, value] of Object.entries(args.limits))
      if (!Number.isSafeInteger(value) || value <= 0)
        throw new TypeError(`${name} must be a positive integer`);
    const dayKey = args.dayKey ?? new Date().toISOString().slice(0, 10);
    return this.transaction(() => {
      if (args.spendScopeId) {
        this.db
          .prepare(
            "INSERT OR IGNORE INTO run_spend_scopes(run_id,spend_scope_id) VALUES(?,?)",
          )
          .run(args.runId, args.spendScopeId);
        const bound = this.db
          .prepare("SELECT spend_scope_id FROM run_spend_scopes WHERE run_id=?")
          .get(args.runId) as { spend_scope_id: string };
        if (bound.spend_scope_id !== args.spendScopeId)
          throw new Error(
            `Run ${args.runId} is already bound to spend scope ${bound.spend_scope_id}`,
          );
      }
      const scopes = [
        ["day", dayKey, args.limits.dayMicroUsd, "day_key"],
        ["run", args.runId, args.limits.runMicroUsd, "run_id"],
        ["lead", args.leadId, args.limits.leadMicroUsd, "lead_id"],
        ...(args.spendScopeId && args.limits.totalMicroUsd
          ? [
              [
                "total",
                args.spendScopeId,
                args.limits.totalMicroUsd,
                "spend_scope_id",
              ] as const,
            ]
          : []),
      ] as const;
      for (const [scope, id, limit, column] of scopes) {
        this.db
          .prepare(
            `INSERT INTO budget_accounts(scope_type,scope_id,limit_micro_usd) VALUES(?,?,?)
          ON CONFLICT(scope_type,scope_id) DO UPDATE SET limit_micro_usd=MIN(limit_micro_usd,excluded.limit_micro_usd)`,
          )
          .run(scope, id, limit);
        const account = this.db
          .prepare(
            "SELECT limit_micro_usd,blocked FROM budget_accounts WHERE scope_type=? AND scope_id=?",
          )
          .get(scope, id) as { limit_micro_usd: number; blocked: number };
        const used = this.db
          .prepare(
            `SELECT COALESCE(SUM(CASE WHEN state='settled' THEN actual_cost_micro_usd ELSE amount_micro_usd END),0) AS used
          FROM budget_reservations WHERE ${column}=? AND state IN (${statesHeld},'settled')`,
          )
          .get(id) as { used: number };
        const available = account.limit_micro_usd - used.used;
        if (account.blocked || args.amountMicroUsd > available)
          throw new BudgetExceededError(scope, available, args.amountMicroUsd);
      }
      this.db
        .prepare(
          `INSERT INTO budget_reservations(reservation_id,attempt_id,spend_scope_id,day_key,run_id,lead_id,amount_micro_usd,state)
        VALUES(?,?,?,?,?,?,?,'reserved')`,
        )
        .run(
          args.reservationId,
          args.attemptId,
          args.spendScopeId ?? null,
          dayKey,
          args.runId,
          args.leadId,
          args.amountMicroUsd,
        );
      this.db
        .prepare(
          "UPDATE agent_attempts SET state='reserved',reserved_cost_micro_usd=?,billing_status='reserved',updated_at=CURRENT_TIMESTAMP WHERE attempt_id=?",
        )
        .run(args.amountMicroUsd, args.attemptId);
      return {
        reservationId: args.reservationId,
        state: "reserved",
        amountMicroUsd: args.amountMicroUsd,
        dayKey,
      };
    });
  }

  markDispatched(reservationId: string): void {
    this.transaction(() => {
      const row = this.reservation(reservationId);
      if (row.state !== "reserved")
        throw new Error(
          `Reservation ${reservationId} is ${row.state}, expected reserved`,
        );
      this.db
        .prepare(
          "UPDATE budget_reservations SET state='dispatched',updated_at=CURRENT_TIMESTAMP WHERE reservation_id=?",
        )
        .run(reservationId);
      this.db
        .prepare(
          "UPDATE agent_attempts SET state='dispatched',billing_status='reserved',updated_at=CURRENT_TIMESTAMP WHERE attempt_id=?",
        )
        .run(row.attempt_id);
    });
  }

  markBudgetUncertain(reservationId: string, reason: string): void {
    this.transaction(() => {
      const row = this.reservation(reservationId);
      if (!["reserved", "dispatched"].includes(row.state))
        throw new Error(
          `Reservation ${reservationId} cannot become uncertain from ${row.state}`,
        );
      this.db
        .prepare(
          "UPDATE budget_reservations SET state='uncertain',uncertainty_reason=?,updated_at=CURRENT_TIMESTAMP WHERE reservation_id=?",
        )
        .run(reason, reservationId);
      this.db
        .prepare(
          "UPDATE agent_attempts SET state='uncertain',billing_status='uncertain',error_type=?,updated_at=CURRENT_TIMESTAMP WHERE attempt_id=?",
        )
        .run(reason, row.attempt_id);
      this.db
        .prepare(
          "INSERT OR REPLACE INTO usage_ledger(reservation_id,attempt_id,actual_cost_micro_usd,raw_usage_json,normalized_usage_json,billing_status) VALUES(?,?,NULL,NULL,NULL,'uncertain')",
        )
        .run(reservationId, row.attempt_id);
    });
  }

  releaseBudget(reservationId: string, reason: string): void {
    this.transaction(() => {
      const row = this.reservation(reservationId);
      if (!["reserved", "dispatched"].includes(row.state))
        throw new Error(
          `Reservation ${reservationId} cannot release from ${row.state}`,
        );
      this.db
        .prepare(
          "UPDATE budget_reservations SET state='released',uncertainty_reason=?,updated_at=CURRENT_TIMESTAMP WHERE reservation_id=?",
        )
        .run(reason, reservationId);
      this.db
        .prepare(
          "UPDATE agent_attempts SET billing_status='released',updated_at=CURRENT_TIMESTAMP WHERE attempt_id=?",
        )
        .run(row.attempt_id);
    });
  }

  countAttempts(stepId: string, kind?: AttemptInput["kind"]): number {
    const row = kind
      ? this.db
          .prepare(
            "SELECT COUNT(*) count FROM agent_attempts WHERE step_id=? AND kind=?",
          )
          .get(stepId, kind)
      : this.db
          .prepare("SELECT COUNT(*) count FROM agent_attempts WHERE step_id=?")
          .get(stepId);
    return (row as { count: number }).count;
  }

  settleBudget(
    reservationId: string,
    usage: {
      actualCostMicroUsd: number;
      rawUsage: unknown;
      normalizedUsage?: unknown;
    },
  ): void {
    if (
      !Number.isSafeInteger(usage.actualCostMicroUsd) ||
      usage.actualCostMicroUsd < 0
    )
      throw new TypeError("actualCostMicroUsd must be a non-negative integer");
    this.transaction(() => {
      const row = this.reservation(reservationId);
      if (!["dispatched", "uncertain"].includes(row.state))
        throw new Error(
          `Reservation ${reservationId} cannot settle from ${row.state}`,
        );
      this.db
        .prepare(
          "UPDATE budget_reservations SET state='settled',actual_cost_micro_usd=?,updated_at=CURRENT_TIMESTAMP WHERE reservation_id=?",
        )
        .run(usage.actualCostMicroUsd, reservationId);
      this.db
        .prepare(
          `INSERT OR REPLACE INTO usage_ledger(reservation_id,attempt_id,actual_cost_micro_usd,raw_usage_json,normalized_usage_json,billing_status)
        VALUES(?,?,?,?,?,'settled')`,
        )
        .run(
          reservationId,
          row.attempt_id,
          usage.actualCostMicroUsd,
          JSON.stringify(usage.rawUsage),
          JSON.stringify(usage.normalizedUsage ?? null),
        );
      this.db
        .prepare(
          "UPDATE agent_attempts SET billing_status='settled',actual_cost_micro_usd=?,raw_usage_json=?,normalized_usage_json=?,updated_at=CURRENT_TIMESTAMP WHERE attempt_id=?",
        )
        .run(
          usage.actualCostMicroUsd,
          JSON.stringify(usage.rawUsage),
          JSON.stringify(usage.normalizedUsage ?? null),
          row.attempt_id,
        );
      if (usage.actualCostMicroUsd > row.amount_micro_usd) {
        this.db
          .prepare(
            "UPDATE budget_accounts SET blocked=1 WHERE (scope_type='total' AND scope_id=?) OR (scope_type='day' AND scope_id=?) OR (scope_type='run' AND scope_id=?) OR (scope_type='lead' AND scope_id=?)",
          )
          .run(row.spend_scope_id, row.day_key, row.run_id, row.lead_id);
      }
    });
  }

  getBudgetStatus(filter: {
    spendScopeId?: string;
    dayKey?: string;
    runId?: string;
    leadId?: string;
  }): BudgetStatus {
    const selected = filter.spendScopeId
      ? ["total", "spend_scope_id", filter.spendScopeId]
      : filter.runId
        ? ["run", "run_id", filter.runId]
        : filter.leadId
          ? ["lead", "lead_id", filter.leadId]
          : filter.dayKey
            ? ["day", "day_key", filter.dayKey]
            : null;
    if (!selected)
      throw new TypeError(
        "A spendScopeId, dayKey, runId, or leadId is required",
      );
    const [scope, column, id] = selected;
    const sums = this.db
      .prepare(
        `SELECT
      COALESCE(SUM(CASE WHEN state='settled' THEN actual_cost_micro_usd ELSE 0 END),0) settled,
      COALESCE(SUM(CASE WHEN state IN ('reserved','dispatched') THEN amount_micro_usd ELSE 0 END),0) reserved,
      COALESCE(SUM(CASE WHEN state='uncertain' THEN amount_micro_usd ELSE 0 END),0) uncertain
      FROM budget_reservations WHERE ${column}=?`,
      )
      .get(id) as { settled: number; reserved: number; uncertain: number };
    const account = this.db
      .prepare(
        "SELECT limit_micro_usd,blocked FROM budget_accounts WHERE scope_type=? AND scope_id=?",
      )
      .get(scope, id) as
      { limit_micro_usd: number; blocked: number } | undefined;
    const limit = account?.limit_micro_usd ?? null;
    const available =
      limit === null
        ? null
        : limit - sums.settled - sums.reserved - sums.uncertain;
    return {
      limitMicroUsd: limit,
      settledMicroUsd: sums.settled,
      reservedMicroUsd: sums.reserved,
      uncertainMicroUsd: sums.uncertain,
      availableMicroUsd: available,
      blocked: Boolean(account?.blocked),
    };
  }

  private reservation(reservationId: string): {
    attempt_id: string;
    spend_scope_id: string | null;
    day_key: string;
    run_id: string;
    lead_id: string;
    amount_micro_usd: number;
    state: string;
  } {
    const row = this.db
      .prepare("SELECT * FROM budget_reservations WHERE reservation_id=?")
      .get(reservationId) as any;
    if (!row) throw new Error(`Unknown reservation ${reservationId}`);
    return row;
  }
}
