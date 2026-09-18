import { Buffer } from "node:buffer";
import { writeFile } from "node:fs/promises";
import process from "node:process";

const MAX_REPORT_BYTES = 20_000_000;

async function main() {
  const options = JSON.parse(process.argv[2]);
  const lighthouseModule = await import("lighthouse");
  const runner = await lighthouseModule.default(options.website, {
    port: options.debuggingPort,
    logLevel: "silent",
    output: "json",
    onlyCategories: ["performance"],
    formFactor: "mobile",
    maxWaitForLoad: options.maxWaitForLoadMs,
    disableStorageReset: false,
  });
  if (!runner?.lhr) throw new Error("Lighthouse returned no result");
  const reportText =
    typeof runner.report === "string"
      ? runner.report
      : JSON.stringify(runner.lhr);
  if (Buffer.byteLength(reportText, "utf8") > MAX_REPORT_BYTES)
    throw new Error("Lighthouse report exceeded its byte limit");
  await writeFile(options.reportPath, reportText, "utf8");
}

try {
  await main();
  process.exit(0);
} catch (error) {
  process.stderr.write(String(error));
  process.exit(1);
}
