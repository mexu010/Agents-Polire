#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Command } from "commander";
import dotenv from "dotenv";
import { parse } from "csv-parse/sync";
import {
  defaultConfig,
  loadConfig,
  validateConfig,
  type FactoryConfig,
} from "./config.js";
import { id, type AgentName, type JsonObject } from "./contracts.js";
import { Factory } from "./orchestrator.js";
import { startPreview } from "./preview.js";
import { ModelProvider } from "./provider.js";
import { Store } from "./store.js";
import { Evaluation } from "./evaluation.js";
import { registerWorkflowCommands } from "./workflow-cli.js";

type GlobalOptions = { config?: string; dataDir?: string };
function configured(
  global: GlobalOptions,
  mode?: "fixture" | "live",
  budgetUsd?: number,
  autoGenerate?: boolean,
): FactoryConfig {
  if (mode !== undefined && !["fixture", "live"].includes(mode))
    throw new Error("mode must be fixture or live");
  dotenv.config({ path: resolve(".env"), quiet: true });
  if (global.config)
    dotenv.config({
      path: resolve(dirname(resolve(global.config)), ".env"),
      override: false,
      quiet: true,
    });
  const config = structuredClone(
    global.config ? loadConfig(global.config) : defaultConfig(),
  ) as FactoryConfig;
  if (global.dataDir) config.dataDir = resolve(global.dataDir);
  if (mode === "live" && !global.config)
    throw new Error("live mode requires an explicit validated --config file");
  if (mode) config.mode = mode;
  if (autoGenerate !== undefined) config.autoGenerate = autoGenerate;
  if (budgetUsd !== undefined) {
    if (
      [
        config.budgets.leadMicroUsd,
        config.budgets.runMicroUsd,
        config.budgets.dayMicroUsd,
        config.budgets.totalMicroUsd,
      ].some((v) => v === null || !Number.isSafeInteger(v) || v <= 0) ||
      !config.budgets.spendScopeId?.trim()
    )
      throw new Error(
        "--budget-usd only lowers existing configured budgets with an explicit spendScopeId",
      );
    if (
      !Number.isFinite(budgetUsd) ||
      budgetUsd <= 0 ||
      Math.floor(budgetUsd * 1_000_000) < 1 ||
      !Number.isSafeInteger(Math.floor(budgetUsd * 1_000_000))
    )
      throw new Error(
        "--budget-usd must be positive and representable in micro-USD",
      );
    const micro = Math.floor(budgetUsd * 1_000_000);
    const cap = (value: number | null) => Math.min(value!, micro);
    config.budgets = {
      ...config.budgets,
      leadMicroUsd: cap(config.budgets.leadMicroUsd),
      runMicroUsd: cap(config.budgets.runMicroUsd),
      dayMicroUsd: cap(config.budgets.dayMicroUsd),
      totalMicroUsd: cap(config.budgets.totalMicroUsd),
    };
  }
  if (
    config.mode === "live" &&
    ([
      config.budgets.leadMicroUsd,
      config.budgets.runMicroUsd,
      config.budgets.dayMicroUsd,
      config.budgets.totalMicroUsd,
    ].some((x) => x === null) ||
      !config.budgets.spendScopeId)
  )
    throw new Error(
      "live mode requires positive lead/run/day/total budgets and a persistent spendScopeId",
    );
  return structuredClone(validateConfig(config));
}
async function useFactory<T>(
  global: GlobalOptions,
  fn: (factory: Factory, store: Store) => Promise<T> | T,
  mode?: "fixture" | "live",
  budget?: number,
  auto?: boolean,
): Promise<T> {
  const config = configured(global, mode, budget, auto);
  const store = new Store(config.dataDir);
  try {
    return await fn(new Factory(config, store), store);
  } finally {
    store.close();
  }
}
function print(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
function runOutput(job: JsonObject): JsonObject {
  const review = job.context?.demoReview;
  if (!review) return job;
  return {
    ...job,
    analysisReview: review,
    reviewCommand: `factory review ${job.id}`,
    decisionCommands: {
      approve: `factory demo-decision ${job.id} approve --revision ${job.revision} --review-hash ${review.reviewHash}`,
      reject: `factory demo-decision ${job.id} reject --revision ${job.revision} --review-hash ${review.reviewHash}`,
    },
  };
}

const cli = new Command()
  .name("factory")
  .description("Local POLIRE website factory; never sends outreach")
  .option("--config <file>")
  .option("--data-dir <dir>");
cli
  .command("doctor")
  .option("--mode <mode>", "fixture or live", "fixture")
  .option("--budget-usd <amount>", "lower the configured total USD cap", Number)
  .action(async (o, cmd) => {
    const config = configured(cmd.optsWithGlobals(), o.mode, o.budgetUsd);
    if (config.mode === "fixture")
      return print({ mode: "fixture", ok: true, paid: false });
    const store = new Store(config.dataDir);
    try {
      print(await new ModelProvider(config, store).doctor());
    } finally {
      store.close();
    }
  });
cli
  .command("run")
  .requiredOption("--domain <url>")
  .requiredOption("--mode <mode>", "fixture or live")
  .option("--stop-after <agent>")
  .option("--run-id <id>", "stable run identity for safe continuation")
  .option("--budget-usd <amount>", "lower the configured total USD cap", Number)
  .option("--experimental")
  .action(async (o, cmd) =>
    print(
      runOutput(
        await useFactory(
          cmd.optsWithGlobals(),
          (f) =>
            f.runLead(o.domain, {
              runId: o.runId,
              stopAfter: o.stopAfter as AgentName | undefined,
              experimental: o.experimental,
            }),
          o.mode,
          o.budgetUsd,
        ),
      ),
    ),
  );
cli
  .command("show")
  .argument("<run-id>")
  .action(async (runId, _, cmd) =>
    print(await useFactory(cmd.optsWithGlobals(), (f) => f.show(runId))),
  );
cli
  .command("review")
  .argument("<run-id>")
  .description("Show the current analysis review and demo eligibility")
  .action(async (runId, _, cmd) =>
    print(await useFactory(cmd.optsWithGlobals(), (f) => f.review(runId))),
  );
cli
  .command("demo-decision")
  .argument("<run-id>")
  .argument("<decision>", "approve or reject")
  .requiredOption("--revision <number>", "expected job revision", Number)
  .requiredOption("--review-hash <hash>", "current analysis review hash")
  .description("Approve or reject building the reviewed demo")
  .action(async (runId, decision, o, cmd) => {
    if (!["approve", "reject"].includes(decision))
      throw new Error("decision must be approve or reject");
    print(
      await useFactory(cmd.optsWithGlobals(), (f) =>
        f.decideDemo(
          runId,
          decision as "approve" | "reject",
          o.revision,
          o.reviewHash,
        ),
      ),
    );
  });
cli
  .command("resume")
  .argument("<run-id>")
  .option("--revision <number>", "expected job revision", Number)
  .action(async (runId, o, cmd) =>
    print(
      runOutput(
        await useFactory(cmd.optsWithGlobals(), (f) =>
          f.resume(runId, o.revision),
        ),
      ),
    ),
  );
cli
  .command("pause")
  .argument("<run-id>")
  .action(async (runId, _, cmd) =>
    print(
      await useFactory(cmd.optsWithGlobals(), (f) => {
        f.pause(runId);
        return f.show(runId);
      }),
    ),
  );
cli
  .command("cancel")
  .argument("<run-id>")
  .action(async (runId, _, cmd) =>
    print(
      await useFactory(cmd.optsWithGlobals(), (f) => {
        f.cancel(runId);
        return f.show(runId);
      }),
    ),
  );
cli
  .command("delete")
  .argument("<lead-id>")
  .action(async (leadId, _, cmd) =>
    print(
      await useFactory(cmd.optsWithGlobals(), async (f) => {
        await f.deleteLead(leadId);
        return { deleted: true, leadId };
      }),
    ),
  );

const preview = cli.command("preview");
preview
  .command("approve")
  .argument("<run-id>")
  .requiredOption("--hash <hash>")
  .requiredOption("--revision <number>", "expected job revision", Number)
  .action(async (runId, o, cmd) =>
    print(
      await useFactory(cmd.optsWithGlobals(), (f) =>
        f.approvePreview(runId, o.hash, o.revision),
      ),
    ),
  );
preview
  .command("attach")
  .argument("<run-id>")
  .requiredOption("--url <url>")
  .requiredOption("--hash <hash>")
  .option("--fixture-simulated")
  .action(async (runId, o, cmd) =>
    print(
      await useFactory(cmd.optsWithGlobals(), (f) =>
        f.attachExternalPreview(
          runId,
          o.url,
          o.hash,
          Boolean(o.fixtureSimulated),
        ),
      ),
    ),
  );
preview
  .command("open")
  .argument("<run-id>")
  .action(async (runId, _, cmd) => {
    const global = cmd.optsWithGlobals();
    const config = configured(global);
    const store = new Store(config.dataDir);
    const factory = new Factory(config, store);
    const job = factory.show(runId);
    const server = await startPreview({
      artifactDir: job.context.render.artifactDir,
      token: id(),
      expiresAt: job.context.render.manifest.expires_at,
    });
    print({
      url: server.url,
      notice: "Protected local preview. Press Ctrl+C to stop.",
    });
    const close = async () => {
      await server.close();
      store.close();
      process.exit(0);
    };
    process.once("SIGINT", close);
    process.once("SIGTERM", close);
  });
cli
  .command("sales")
  .command("draft")
  .argument("<run-id>")
  .action(async (runId, _, cmd) =>
    print(await useFactory(cmd.optsWithGlobals(), (f) => f.draftSales(runId))),
  );
cli
  .command("contact")
  .command("set")
  .argument("<run-id>")
  .requiredOption("--status <status>", "approved, unknown, or blocked")
  .requiredOption("--reason <reason>")
  .action(async (runId, o, cmd) =>
    print(
      await useFactory(cmd.optsWithGlobals(), (f) =>
        f.setContact(runId, o.status, o.reason),
      ),
    ),
  );
cli
  .command("outreach")
  .command("approve")
  .argument("<run-id>")
  .requiredOption("--hash <hash>")
  .requiredOption("--revision <number>", "expected job revision", Number)
  .action(async (runId, o, cmd) =>
    print(
      await useFactory(cmd.optsWithGlobals(), (f) =>
        f.approveOutreach(runId, o.hash, o.revision),
      ),
    ),
  );
cli
  .command("export")
  .argument("<run-id>")
  .requiredOption("--kind <kind>", "internal or ready")
  .action(async (runId, o, cmd) =>
    print(
      await useFactory(cmd.optsWithGlobals(), (f) =>
        f.exportDraft(runId, o.kind),
      ),
    ),
  );

cli
  .command("lead")
  .command("import")
  .argument("<file>")
  .action(async (file, _, cmd) => {
    const global = cmd.optsWithGlobals();
    const config = configured(global);
    const store = new Store(config.dataDir);
    try {
      const rows = parse(readFileSync(resolve(file), "utf8"), {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as JsonObject[];
      const imported = rows.map((row) => {
        const website = row.website ?? row.domain;
        if (!website)
          throw new Error("lead import requires a website or domain column");
        const leadId = `lead-${id()}`;
        store.put("leads", leadId, {
          website,
          new: true,
          importedAt: new Date().toISOString(),
        });
        return { leadId, website };
      });
      print({ imported });
    } finally {
      store.close();
    }
  });

cli
  .command("demo")
  .description(
    "Run all seven fixture agents, actual rendering/browser checks, and explicit simulated operator approvals",
  )
  .action(async (_, cmd) => {
    const global = cmd.optsWithGlobals();
    const config = configured(global, "fixture", undefined, true);
    config.agency = {
      name: "POLIRE Fixture",
      sender_name: "Fixture Operator",
      signature: "Fixture only",
      required_notice: "SIMULATED OPERATOR ACTIONS — NOT SENDABLE",
    };
    const store = new Store(config.dataDir);
    try {
      const factory = new Factory(config, store);
      let job = await factory.runLead(
        "https://fixture.alpina-service.example/",
        { experimental: true, requireDemoDecision: true },
      );
      if (job.stage === "demo_review" && job.status === "waiting_approval")
        job = await factory.decideDemo(
          job.id,
          "approve",
          job.revision,
          job.context.demoReview.reviewHash,
        );
      if (job.status !== "waiting_approval")
        return print({
          ...job,
          demo: "STOPPED: actual checks did not pass; no approval was simulated",
        });
      job = factory.approvePreview(job.id, job.artifactHash);
      job = factory.attachExternalPreview(
        job.id,
        "https://customer-preview.fixture.test/",
        job.artifactHash,
        true,
      );
      job = factory.setContact(
        job.id,
        "approved",
        "SIMULATED fixture operator contact approval",
      );
      job = await factory.draftSales(job.id);
      job = factory.approveOutreach(job.id, job.draftHash);
      const exported = await factory.exportDraft(job.id, "ready");
      print({
        demo: "SIMULATED OPERATOR APPROVALS; NO MESSAGE SENT",
        runId: job.id,
        leadId: job.leadId,
        agentSteps: store
          .list("steps")
          .filter((x) => x.runId === job.id)
          .map((x) => x.agent),
        actualBrowserChecks: job.context.browser.results.length,
        exported,
      });
    } finally {
      store.close();
    }
  });

const evaluation = cli.command("eval");
evaluation
  .command("init")
  .option("--suite <name>", "suite name", "representative-20")
  .action(async (o, cmd) =>
    print(
      await useFactory(cmd.optsWithGlobals(), (_, store) =>
        new Evaluation(configured(cmd.optsWithGlobals()), store).initSuite(
          o.suite,
        ),
      ),
    ),
  );
evaluation
  .command("import")
  .requiredOption("--suite <name>")
  .argument("<file>")
  .action(async (file, o, cmd) =>
    print(
      await useFactory(cmd.optsWithGlobals(), (_, store) =>
        new Evaluation(configured(cmd.optsWithGlobals()), store).importCase(
          o.suite,
          file,
        ),
      ),
    ),
  );
evaluation
  .command("run")
  .requiredOption("--suite <name>")
  .action(async (o, cmd) =>
    print(
      await useFactory(cmd.optsWithGlobals(), (_, store) =>
        new Evaluation(configured(cmd.optsWithGlobals()), store).runSuite(
          o.suite,
        ),
      ),
    ),
  );
evaluation
  .command("review")
  .argument("<result-id>")
  .argument("<file>")
  .action(async (resultId, file, cmd) =>
    print(
      await useFactory(cmd.optsWithGlobals(), (_, store) =>
        new Evaluation(configured(cmd.optsWithGlobals()), store).review(
          resultId,
          JSON.parse(readFileSync(resolve(file), "utf8")),
        ),
      ),
    ),
  );
evaluation
  .command("report")
  .requiredOption("--suite <name>")
  .action(async (o, cmd) =>
    print(
      await useFactory(cmd.optsWithGlobals(), (_, store) =>
        new Evaluation(configured(cmd.optsWithGlobals()), store).report(
          o.suite,
        ),
      ),
    ),
  );

cli
  .command("revise")
  .argument("<run-id>")
  .requiredOption("--revision <number>", "expected job revision", Number)
  .requiredOption(
    "--file <file>",
    "JSON file containing campaign, offer, agency, or recrawl",
  )
  .action(async (runId, o, cmd) => {
    const patch = JSON.parse(readFileSync(resolve(o.file), "utf8"));
    print(
      await useFactory(cmd.optsWithGlobals(), (factory) =>
        factory.revise(runId, o.revision, patch),
      ),
    );
  });

registerWorkflowCommands(cli, configured, print);

await cli.parseAsync().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
