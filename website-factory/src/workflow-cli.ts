import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Command } from "commander";
import { parse } from "csv-parse/sync";
import type { FactoryConfig } from "./config.js";
import { Factory } from "./orchestrator.js";
import { Store } from "./store.js";
import { runBatch, runTrace, writeReviewReport } from "./workflow.js";
import { ResearchService } from "./research.js";
import {
  runResearchAgent,
  resumeStoppedResearch,
  type ResearchDecisionProvider,
  type ResearchTools,
} from "./agent-loop.js";
import { ModelProvider } from "./provider.js";
import { type JsonObject } from "./contracts.js";

type Configure = (
  global: { config?: string; dataDir?: string },
  mode?: "fixture" | "live",
) => FactoryConfig;
export function registerWorkflowCommands(
  cli: Command,
  configure: Configure,
  print: (value: unknown) => void,
): void {
  const withFactory = async (
    cmd: Command,
    fn: (f: Factory) => unknown,
    mode?: "fixture" | "live",
  ) => {
    const config = configure(cmd.optsWithGlobals(), mode);
    const store = new Store(config.dataDir);
    try {
      return await fn(new Factory(config, store));
    } finally {
      store.close();
    }
  };
  cli
    .command("batch")
    .requiredOption("--file <csv>", "CSV with website column")
    .requiredOption("--batch-id <id>")
    .requiredOption("--mode <mode>", "fixture or live")
    .option("--retry-failed")
    .description(
      "Analyse a bounded batch; preserve each run and stop before demo approval",
    )
    .action(async (o, cmd) => {
      const rows = parse(readFileSync(resolve(o.file), "utf8"), {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as JsonObject[];
      print(
        await withFactory(
          cmd,
          (f) =>
            runBatch(f, {
              batchId: o.batchId,
              websites: rows.map((r) => r.website ?? r.domain),
              retryFailed: o.retryFailed,
            }),
          o.mode,
        ),
      );
    });
  cli
    .command("report")
    .argument("<run-id>")
    .description(
      "Write a persistent Markdown review, including partial failures",
    )
    .action(async (runId, _, cmd) =>
      print(
        await withFactory(cmd, (f) => ({
          path: writeReviewReport(f.config.dataDir, f.show(runId)),
        })),
      ),
    );
  cli
    .command("trace")
    .argument("<run-id>")
    .description("Show stage events, tool decisions and available usage")
    .action(async (runId, _, cmd) => {
      const config = configure(cmd.optsWithGlobals());
      const store = new Store(config.dataDir);
      try {
        const factory = new Factory(config, store);
        const research = store
          .list("research_agent_runs")
          .filter((r) => r.runId === runId);
        if (research.length) {
          print({
            research,
            tools: store
              .list("research-event")
              .filter((r) => r.runId === runId),
            usage: store.db
              .prepare(
                "SELECT provider,requested_model,reported_model,state,normalized_usage_json,actual_cost_micro_usd,billing_status,error_type FROM agent_attempts WHERE run_id=?",
              )
              .all(runId)
              .map((row: any) => {
                const { normalized_usage_json, ...attempt } = row;
                return {
                  ...attempt,
                  usage: normalized_usage_json
                    ? JSON.parse(normalized_usage_json)
                    : null,
                };
              }),
            reservations: store.db
              .prepare(
                "SELECT amount_micro_usd,actual_cost_micro_usd,state FROM budget_reservations WHERE run_id=?",
              )
              .all(runId),
            retryEvents: store
              .list("research_agent_events")
              .filter((r) => r.runId === runId),
          });
        } else print(runTrace(factory, runId));
      } finally {
        store.close();
      }
    });
  cli
    .command("runs")
    .description("List saved runs and next required action")
    .action(async (_, cmd) =>
      print(
        await withFactory(cmd, (f) =>
          f.store.db
            .prepare(
              "SELECT run_id,stage,status,revision,updated_at FROM factory_jobs ORDER BY updated_at DESC",
            )
            .all(),
        ),
      ),
    );
  cli
    .command("business-review")
    .argument("<run-id>")
    .requiredOption("--revision <number>", "current revision", Number)
    .requiredOption("--file <json>", "dated operator evidence review")
    .description(
      "Record source-backed business activity; never infer it from a working website",
    )
    .action(async (runId, o, cmd) =>
      print(
        await withFactory(cmd, (f) =>
          f.recordBusinessReview(
            runId,
            o.revision,
            JSON.parse(readFileSync(resolve(o.file), "utf8")),
          ),
        ),
      ),
    );
  cli
    .command("discover")
    .requiredOption("--objective <text>")
    .requiredOption("--run-id <id>", "persistent research identity")
    .requiredOption("--mode <mode>", "fixture or live")
    .option(
      "--retry-stopped",
      "explicitly resume an eligible stopped research run without resetting limits",
    )
    .option(
      "--analyse",
      "analyse candidates after research; still stops for demo approval",
    )
    .description(
      "Bounded Scout decision/tool loop: search, read sources, finish or stop",
    )
    .action(async (o, cmd) => {
      const config = configure(cmd.optsWithGlobals(), o.mode);
      if (
        config.mode === "live" &&
        (!config.research.enabled ||
          !process.env.BRAVE_SEARCH_API_KEY ||
          !config.research.queryCostMicroUsd)
      )
        throw new Error(
          "Live discovery requires research.enabled, explicit query price and local BRAVE_SEARCH_API_KEY",
        );
      const store = new Store(config.dataDir);
      try {
        const fixtureUrl = "https://fixture.alpina-service.example/";
        const service = new ResearchService({
          store,
          runId: o.runId,
          maxQueriesPerRun: config.research.maxQueries,
          maxResultsPerQuery: config.research.maxResults,
          maxPagesPerRun: config.research.maxPages,
          ...(config.mode === "fixture"
            ? {
                searchTransport: async () => [
                  {
                    url: fixtureUrl,
                    title: "SIMULATED company",
                    snippet: "Fixture evidence only",
                  },
                ],
                fetchTransport: async (url: string) => ({
                  url,
                  status: 200,
                  contentType: "text/html",
                  body: "<h1>SIMULATED Alpina fixture</h1><p>Not a real company.</p>",
                }),
              }
            : {
                billing: {
                  leadId: `research-${o.runId}`,
                  spendScopeId: config.budgets.spendScopeId!,
                  limits: {
                    leadMicroUsd: config.budgets.leadMicroUsd!,
                    runMicroUsd: config.budgets.runMicroUsd!,
                    dayMicroUsd: config.budgets.dayMicroUsd!,
                    totalMicroUsd: config.budgets.totalMicroUsd!,
                  },
                  queryCostMicroUsd: config.research.queryCostMicroUsd!,
                },
              }),
        });
        const tools: ResearchTools = {
          search: async (q, opts) => {
            const r = await service.discover(q, opts);
            return {
              ...r,
              results: r.results.map((row) => ({
                ...row,
                title: row.title ?? "",
                snippet: row.snippet ?? "",
              })),
            };
          },
          readPage: async (url) => {
            const r = await service.read(url);
            return { ...r, contentType: r.contentType ?? "" };
          },
        };
        const fixtureProvider: ResearchDecisionProvider = {
          decideResearch: async ({ input }) => {
            const step = input.step;
            return step === 0
              ? {
                  action: "search",
                  query: o.objective,
                  url: null,
                  candidate_urls: [],
                  reason: "Fixture search",
                }
              : step === 1
                ? {
                    action: "read_page",
                    query: null,
                    url: fixtureUrl,
                    candidate_urls: [],
                    reason: "Fixture read",
                  }
                : {
                    action: "finish",
                    query: null,
                    url: null,
                    candidate_urls: [fixtureUrl],
                    reason: "Synthetic evidence only",
                  };
          },
        };
        const provider =
          config.mode === "live"
            ? new ModelProvider(config, store)
            : fixtureProvider;
        if (o.retryStopped)
          resumeStoppedResearch(store, o.runId, `research-${o.runId}`);
        const result = await runResearchAgent({
          store,
          provider,
          tools,
          runId: o.runId,
          leadId: `research-${o.runId}`,
          objective: o.objective,
          maxSteps: config.research.maxSteps,
        });
        let batch: JsonObject | null = null;
        if (
          o.analyse &&
          result.status === "completed" &&
          result.candidateUrls.length
        )
          batch = await runBatch(new Factory(config, store), {
            batchId: o.runId,
            websites: result.candidateUrls,
          });
        print({
          mode: config.mode,
          fixtureDisclosure:
            config.mode === "fixture"
              ? "Simulated search and model decisions; not real leads."
              : null,
          ...result,
          batch,
        });
      } finally {
        store.close();
      }
    });
}
