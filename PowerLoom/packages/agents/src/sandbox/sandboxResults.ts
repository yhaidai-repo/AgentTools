import type { SandboxAnswer } from "@powerloom/sandbox";
import type { OutsideResource } from "../models/OutsideResource";
import type { OutsideToolResult } from "../models/OutsideToolResult";
import type { RunSandbox } from "./models/RunSandbox";
import type { SandboxAccess } from "./models/SandboxAccess";

// A failed sandbox answer as the agent and the log see it: a rule's refusal is `refused`, the token `denied`.
export function failure(answer: Extract<SandboxAnswer<unknown>, { ok: false }>): OutsideToolResult {
  if (answer.failure === "refused") {
    return { text: answer.message, isError: true, refusal: answer.message };
  }

  return { text: answer.message, isError: true, denied: answer.failure === "denied" };
}

export function noSandbox(): OutsideToolResult {
  return { text: "No sandbox is open: call sandbox_open first.", isError: true };
}

export function resourceOf(access: SandboxAccess, sandbox: RunSandbox, detail?: string): OutsideResource {
  const name = sandbox.info ? `sandbox:${sandbox.info.id}` : "sandbox";

  return { kind: "sandbox", resource: detail ? `${name} ${detail}` : name, target: access.url };
}
