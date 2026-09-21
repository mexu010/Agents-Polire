import type { FactoryConfig } from "./config.js";
import type { Store } from "./store.js";

type Limits = Pick<
  FactoryConfig["oauth"],
  "scopeId" | "maxCallsPerRun" | "maxCallsPerDay" | "maxCallsTotal"
>;
export class OAuthQuotaError extends Error {
  readonly code = "OAUTH_CALL_LIMIT";
}

/** A reservation is a consumed logical turn, even after timeout or process loss. No USD billing is inferred. */
export function reserveOAuthCall(
  store: Store,
  limits: Limits,
  call: { attemptId: string; runId: string },
): void {
  if (
    !limits.scopeId?.trim() ||
    !call.runId?.trim() ||
    !call.attemptId?.trim() ||
    [limits.maxCallsPerRun, limits.maxCallsPerDay, limits.maxCallsTotal].some(
      (n) => !Number.isSafeInteger(n) || n <= 0,
    )
  )
    throw new OAuthQuotaError("Invalid OAuth call limits");
  store.transaction(() => {
    const bound = store.get("oauth_run_scopes", call.runId);
    if (bound && bound.scopeId !== limits.scopeId)
      throw new OAuthQuotaError("OAuth run scope cannot change");
    if (store.get("oauth_calls", call.attemptId))
      throw new OAuthQuotaError("OAuth call is already reserved");
    const old = store.get("oauth_scope_limits", limits.scopeId);
    const effective = { ...limits };
    for (const key of [
      "maxCallsPerRun",
      "maxCallsPerDay",
      "maxCallsTotal",
    ] as const)
      effective[key] = Math.min(limits[key], old?.[key] ?? limits[key]);
    const day = new Date().toISOString().slice(0, 10);
    const calls = store
      .list("oauth_calls")
      .filter((r) => r.scopeId === limits.scopeId);
    if (calls.length >= effective.maxCallsTotal)
      throw new OAuthQuotaError("OAuth total call limit reached");
    if (calls.filter((r) => r.day === day).length >= effective.maxCallsPerDay)
      throw new OAuthQuotaError("OAuth day call limit reached");
    if (
      calls.filter((r) => r.runId === call.runId).length >=
      effective.maxCallsPerRun
    )
      throw new OAuthQuotaError("OAuth run call limit reached");
    store.put("oauth_scope_limits", limits.scopeId, effective);
    store.put("oauth_run_scopes", call.runId, { scopeId: limits.scopeId });
    store.put("oauth_calls", call.attemptId, {
      ...call,
      scopeId: limits.scopeId,
      day,
      reservedAt: new Date().toISOString(),
    });
  });
}

export function oauthQuotaStatus(store: Store, scopeId: string) {
  const calls = store.list("oauth_calls").filter((r) => r.scopeId === scopeId);
  return {
    scopeId,
    calls: calls.length,
    today: calls.filter((r) => r.day === new Date().toISOString().slice(0, 10))
      .length,
    limits: store.get("oauth_scope_limits", scopeId),
    accounting: "logical_codex_turns",
    actualCostMicroUsd: null,
  };
}
