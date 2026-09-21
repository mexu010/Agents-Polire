import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";
test("prospect CLI processes 100 synthetic websites, persists output and resumes without more reviews", () => {
  const data = mkdtempSync(join(tmpdir(), "factory-prospect-cli-"));
  const file = join(data, "seeds.csv");
  writeFileSync(
    file,
    "website\n" +
      Array.from({ length: 100 }, (_, i) => `https://firm-${i}.example/`).join(
        "\n",
      ),
  );
  const args = [
    "scripts/run.mjs",
    "prospect",
    "--data-dir",
    data,
    "--file",
    file,
    "--batch-id",
    "hundred",
    "--mode",
    "fixture",
    "--max-reviews",
    "2",
  ];
  const run = () =>
    JSON.parse(
      execFileSync(process.execPath, args, {
        cwd: resolve("."),
        encoding: "utf8",
        timeout: 30000,
      }),
    );
  const a = run();
  expect(a.results).toHaveLength(100);
  expect(a.reportPath).toBeTruthy();
  const b = run();
  expect(b.results).toEqual(a.results);
}, 35000);
test("public script runs a fixture tool loop through approval gate and preserves resume results", () => {
  const data = mkdtempSync(join(tmpdir(), "factory-script-"));
  const args = [
    "scripts/run.mjs",
    "discover",
    "--data-dir",
    data,
    "--mode",
    "fixture",
    "--run-id",
    "script-test",
    "--objective",
    "Synthetic Swiss service company",
    "--analyse",
  ];
  const run = () =>
    JSON.parse(
      execFileSync(process.execPath, args, {
        cwd: resolve("."),
        encoding: "utf8",
        timeout: 30000,
      }),
    );
  const a = run();
  expect(a.mode).toBe("fixture");
  expect(a.status).toBe("completed");
  expect(a.batch.results[0].stage).toBe("demo_review");
  const b = run();
  expect(b.batch.results[0].runId).toBe(a.batch.results[0].runId);
  expect(b.steps).toBe(a.steps);
}, 35000);

test("CLI revalidates a fixture configuration switched to live before dispatch", () => {
  const dir = mkdtempSync(join(tmpdir(), "factory-config-cli-"));
  const file = join(dir, "config.json");
  writeFileSync(
    file,
    JSON.stringify({
      mode: "fixture",
      authentication: "api_key",
      research: { enabled: true },
      budgets: {
        leadMicroUsd: 100000,
        runMicroUsd: 100000,
        dayMicroUsd: 100000,
        totalMicroUsd: 100000,
        spendScopeId: "validation-only",
      },
    }),
  );
  const child = spawnSync(
    process.execPath,
    [
      "scripts/run.mjs",
      "discover",
      "--config",
      file,
      "--mode",
      "live",
      "--run-id",
      "invalid",
      "--objective",
      "test",
    ],
    {
      cwd: resolve("."),
      encoding: "utf8",
      timeout: 30000,
      env: {
        ...process.env,
        OPENAI_API_KEY: "not-a-real-key",
        BRAVE_SEARCH_API_KEY: "not-a-real-key",
      },
    },
  );
  expect(child.status).not.toBe(0);
  expect(child.stderr).toContain(
    "live research requires an explicit search query price",
  );
});

test("budget flag cannot create paid budgets or a spend scope from a fixture config", () => {
  const dir = mkdtempSync(join(tmpdir(), "factory-budget-cli-"));
  const file = join(dir, "config.json");
  writeFileSync(
    file,
    JSON.stringify({ mode: "fixture", authentication: "api_key" }),
  );
  const child = spawnSync(
    process.execPath,
    [
      "scripts/run.mjs",
      "run",
      "--config",
      file,
      "--mode",
      "live",
      "--budget-usd",
      "100000",
      "--domain",
      "https://example.ch",
    ],
    {
      cwd: resolve("."),
      encoding: "utf8",
      timeout: 30000,
    },
  );
  expect(child.status).not.toBe(0);
  expect(child.stderr).toContain("only lowers existing configured budgets");
});

test("budget flag cannot suggest an OAuth model spending cap", () => {
  const child = spawnSync(
    process.execPath,
    [
      "scripts/run.mjs",
      "doctor",
      "--config",
      "config/live-test.json",
      "--mode",
      "live",
      "--budget-usd",
      "1",
    ],
    { cwd: resolve("."), encoding: "utf8", timeout: 30000 },
  );
  expect(child.status).not.toBe(0);
  expect(child.stderr).toContain(
    "--budget-usd applies only to API-key or live research USD costs",
  );
});
