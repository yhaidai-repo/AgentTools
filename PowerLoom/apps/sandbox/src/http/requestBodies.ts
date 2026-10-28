import type { CommandRequest, EditRequest, OpenSandboxRequest, SessionStartRequest, StdinRequest, WriteFileRequest } from "@powerloom/sandbox";
import { BadRequest } from "./BadRequest";

// The bodies the routes take, checked field by field: a wrong one is a 400 naming the field.
export function openRequest(body: Record<string, unknown>): OpenSandboxRequest {
  return { owner: text(body, "owner"), ttlMinutes: positive(body, "ttlMinutes"), image: optionalText(body, "image") };
}

export function commandRequest(body: Record<string, unknown>): CommandRequest {
  return { command: text(body, "command"), cwd: optionalText(body, "cwd"), timeoutMs: positive(body, "timeoutMs") };
}

export function sessionStartRequest(body: Record<string, unknown>): SessionStartRequest {
  return { command: text(body, "command"), cwd: optionalText(body, "cwd"), yieldMs: positive(body, "yieldMs"), maxChars: positive(body, "maxChars") };
}

export function stdinRequest(body: Record<string, unknown>): StdinRequest {
  return { chars: text(body, "chars", true), yieldMs: positive(body, "yieldMs"), maxChars: positive(body, "maxChars") };
}

export function patchText(body: Record<string, unknown>): string {
  return text(body, "patch");
}

export function editRequest(body: Record<string, unknown>): EditRequest {
  return { path: text(body, "path"), oldString: text(body, "oldString", true), newString: text(body, "newString", true), replaceAll: body.replaceAll === true };
}

export function writeFileRequest(body: Record<string, unknown>): WriteFileRequest {
  return { path: text(body, "path"), content: text(body, "content", true) };
}

function text(body: Record<string, unknown>, field: string, mayBeEmpty = false): string {
  const value = body[field];

  if (typeof value !== "string" || (!mayBeEmpty && value.length === 0)) {
    throw new BadRequest(`${field} must be a ${mayBeEmpty ? "" : "non-empty "}string`);
  }

  return value;
}

function optionalText(body: Record<string, unknown>, field: string): string | undefined {
  return body[field] === undefined || body[field] === null || body[field] === "" ? undefined : text(body, field);
}

function positive(body: Record<string, unknown>, field: string): number {
  const value = body[field];

  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new BadRequest(`${field} must be a positive number`);
  }

  return value;
}
