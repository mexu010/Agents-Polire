import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import dotenv from "dotenv";
import { chromium } from "playwright";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env"), quiet: true });
const browser =
  existsSync(chromium.executablePath()) ||
  existsSync("C:/Program Files/Google/Chrome/Application/chrome.exe");
const result = {
  node24OrNewer: Number(process.versions.node.split(".")[0]) >= 24,
  browserInstalled: browser,
  openaiKeyPresent: !!process.env.OPENAI_API_KEY,
  searchKeyPresent: !!process.env.BRAVE_SEARCH_API_KEY,
  paidCalls: 0,
  notice:
    "Offline-Prüfung. Modellberechtigungen und Preise werden hier nicht online bestätigt. doctor prüft Modellfähigkeiten kostenpflichtig im konfigurierten Budget.",
};
process.stdout.write(JSON.stringify(result, null, 2) + "\n");
if (!result.node24OrNewer || !browser) process.exitCode = 1;
