import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import dotenv from "dotenv";
import { chromium } from "playwright";
import { codexEnvironment } from "./codex-env.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env"), quiet: true });
const browser =
  existsSync(chromium.executablePath()) ||
  existsSync("C:/Program Files/Google/Chrome/Application/chrome.exe");
const codex = spawnSync("codex", ["login", "status"], {
  encoding: "utf8",
  env: codexEnvironment(),
  shell: false,
  windowsHide: true,
  timeout: 10000,
});
const status = `${codex.stdout ?? ""}\n${codex.stderr ?? ""}`;
const codexLogin = codex.error
  ? "cli_missing"
  : codex.status !== 0
    ? "not_logged_in"
    : /chatgpt/i.test(status)
      ? "chatgpt"
      : /api.key|api key/i.test(status)
        ? "api_key"
        : "unknown";
const result = {
  node24OrNewer: Number(process.versions.node.split(".")[0]) >= 24,
  browserInstalled: browser,
  codexCliPresent: !codex.error,
  codexLogin,
  searchKeyPresent: !!process.env.BRAVE_SEARCH_API_KEY,
  paidCalls: 0,
  notice:
    "Lokale Prüfung ohne Modellaufruf. Codex CLI und ChatGPT-Anmeldung sind für Live-OAuth erforderlich; doctor meldet den Anmeldestatus ohne Modelltest.",
};
process.stdout.write(JSON.stringify(result, null, 2) + "\n");
if (!result.node24OrNewer || !browser || !result.codexCliPresent)
  process.exitCode = 1;
