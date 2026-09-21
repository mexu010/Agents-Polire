import { spawn } from "node:child_process";
import process from "node:process";
import { codexEnvironment } from "./codex-env.mjs";

const action = process.argv[2];
if (action !== "login" && action !== "status") {
  process.stderr.write("Verwendung: node scripts/auth.mjs login|status\n");
  process.exitCode = 2;
} else {
  const child = spawn(
    "codex",
    ["login", ...(action === "status" ? ["status"] : [])],
    {
      env: codexEnvironment(),
      stdio: "inherit",
      shell: false,
      windowsHide: true,
    },
  );
  child.once("error", () => {
    process.stderr.write(
      "Codex CLI nicht gefunden. Installiere Codex und prüfe, ob 'codex' im PATH liegt.\n",
    );
    process.exitCode = 1;
  });
  child.once("exit", (code) => {
    process.exitCode = code ?? 1;
  });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => child.kill(signal));
}
