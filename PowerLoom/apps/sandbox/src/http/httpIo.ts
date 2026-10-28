import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { BadRequest } from "./BadRequest";

const MAX_JSON_BYTES = 2 * 1024 * 1024;

export function isAuthorized(request: IncomingMessage, token: string): boolean {
  const sent = Buffer.from(request.headers.authorization ?? "");
  const expected = Buffer.from(`Bearer ${token}`);

  return sent.length === expected.length && timingSafeEqual(sent, expected);
}

export async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    size += (chunk as Buffer).length;

    if (size > MAX_JSON_BYTES) {
      throw new BadRequest(`The request body is larger than ${MAX_JSON_BYTES} bytes`);
    }

    chunks.push(chunk as Buffer);
  }

  const parsed: unknown = chunks.length === 0 ? {} : JSON.parse(Buffer.concat(chunks).toString("utf8"));

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new BadRequest("The request body must be a JSON object");
  }

  return parsed as Record<string, unknown>;
}

export function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(value));
}

// Problem details: the `detail` is the sentence the agent reads.
export function sendProblem(response: ServerResponse, status: number, detail: string): void {
  response.writeHead(status, { "Content-Type": "application/problem+json" });
  response.end(JSON.stringify({ status, title: titleOf(status), detail }));
}

function titleOf(status: number): string {
  const titles: Record<number, string> = { 400: "Bad request", 401: "Unauthorized", 404: "Not found", 410: "Gone", 422: "Refused" };

  return titles[status] ?? "Failed";
}
