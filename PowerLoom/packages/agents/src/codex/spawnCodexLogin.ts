import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import type { CodexLoginProcess } from "./models/CodexLoginProcess";

// The Codex CLI the SDK runs (its Linux binary is the @openai/codex platform package in the image).
const CODEX_CLI = createRequire(import.meta.url).resolve("@openai/codex/bin/codex.js");

/** `codex login --device-auth` in PowerLoom's Codex home. */
export function spawnCodexLogin(codexHome: string): CodexLoginProcess {
  const child = spawn(process.execPath, [CODEX_CLI, "login", "--device-auth"], { env: { ...process.env, CODEX_HOME: codexHome }, stdio: ["ignore", "pipe", "pipe"] });

  return {
    onOutput: (listener) => {
      child.stdout.on("data", (chunk: Buffer) => listener(chunk.toString("utf8")));
      child.stderr.on("data", (chunk: Buffer) => listener(chunk.toString("utf8")));
    },
    onExit: (listener) => {
      child.on("exit", (code) => listener(code));
      child.on("error", () => listener(null));
    },
    kill: () => {
      child.kill();
    },
  };
}
