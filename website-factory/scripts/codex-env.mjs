import process from "node:process";

// Give Codex only what it needs to locate its executable and stored login.
// In particular, inherited API credentials must never override ChatGPT login.
const names = [
  "PATH",
  "Path",
  "PATHEXT",
  "SystemRoot",
  "SYSTEMROOT",
  "WINDIR",
  "APPDATA",
  "LOCALAPPDATA",
  "USERPROFILE",
  "HOMEDRIVE",
  "HOMEPATH",
  "HOME",
  "CODEX_HOME",
  "TEMP",
  "TMP",
  "LANG",
  "LC_ALL",
];

export function codexEnvironment(source = process.env) {
  return Object.fromEntries(
    names
      .filter((name) => source[name] !== undefined)
      .map((name) => [name, source[name]]),
  );
}
