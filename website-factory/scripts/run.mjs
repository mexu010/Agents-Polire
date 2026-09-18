import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv
  .slice(2)
  .filter((arg, index) => !(arg === "--" && index === 1));
const child = spawn(
  process.execPath,
  ["--import", "tsx", path.join(root, "src/cli.ts"), ...args],
  { cwd: root, stdio: "inherit", windowsHide: true },
);
child.once("error", () => {
  process.stderr.write(
    "Factory konnte nicht gestartet werden. Zuerst scripts/setup.ps1 ausführen.\n",
  );
  process.exitCode = 1;
});
child.once("exit", (code) => {
  process.exitCode = code ?? 1;
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
