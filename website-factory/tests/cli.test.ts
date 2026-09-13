import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { expect, test } from "vitest";

test("CLI runs an explicitly fixture-mode lead and prints persisted state", () => {
  const dataDir = mkdtempSync(join(tmpdir(), "factory-cli-"));
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "src/cli.ts",
      "run",
      "--domain",
      "https://fixture.alpina-service.example/",
      "--mode",
      "fixture",
      "--stop-after",
      "qualifier",
      "--data-dir",
      dataDir,
    ],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  expect(result.status, result.stderr).toBe(0);
  const output = JSON.parse(result.stdout);
  expect(output).toMatchObject({
    stage: "qualifier",
    status: "paused",
    mode: "fixture",
  });
  expect(output.fixtureDisclosure).toMatch(/simulated/i);
});
