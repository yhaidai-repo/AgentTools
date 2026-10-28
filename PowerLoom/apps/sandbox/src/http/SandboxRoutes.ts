import type { IncomingMessage, ServerResponse } from "node:http";
import type { SandboxRegistry } from "../docker/SandboxRegistry";
import type { Sandbox } from "../docker/Sandbox";
import type { Outcome } from "../models/Outcome";
import { readJson, sendJson, sendProblem } from "./httpIo";
import { commandRequest, editRequest, openRequest, patchText, sessionStartRequest, stdinRequest, writeFileRequest } from "./requestBodies";

type SandboxAction = (sandbox: Sandbox, request: IncomingMessage, parts: string[], url: URL) => Promise<Outcome<unknown>>;

// The routes under /sandboxes/{id}: the second path part names the action, the rest is its own.
const SANDBOX_ACTIONS: Record<string, Record<string, SandboxAction>> = {
  PUT: {
    repos: async (sandbox, request, parts, url) => sandbox.repos.import(parts[3] ?? "", request, url.searchParams.get("message") || "base"),
    files: async (sandbox, request) => sandbox.files.writeFile(writeFileRequest(await readJson(request))),
  },
  POST: {
    commands: async (sandbox, request) => sandbox.commands.run(commandRequest(await readJson(request))),
    sessions: async (sandbox, request, parts) => parts.length > 3 ? sandbox.commands.writeStdin(parts[3], stdinRequest(await readJson(request))) : sandbox.commands.startSession(sessionStartRequest(await readJson(request))),
    patch: async (sandbox, request) => sandbox.files.applyPatch(patchText(await readJson(request))),
    edit: async (sandbox, request) => sandbox.files.edit(editRequest(await readJson(request))),
  },
};

export class SandboxRoutes {
  constructor(private readonly registry: SandboxRegistry) {}

  async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const url = new URL(request.url ?? "/", "http://sandbox");
    const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);

    if (parts[0] !== "sandboxes") {
      return sendProblem(response, 404, `No route ${request.method} ${url.pathname}`);
    }

    if (parts.length === 1) {
      return this.collection(request, response, url);
    }

    return this.member(request, response, parts, url);
  }

  private async collection(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
    if (request.method === "POST") {
      const sandbox = await this.registry.open(openRequest(await readJson(request)));

      return sendJson(response, 201, sandbox.info);
    }

    if (request.method === "GET") {
      return sendJson(response, 200, this.registry.list(url.searchParams.get("ownerPrefix") ?? ""));
    }

    if (request.method === "DELETE") {
      return sendJson(response, 200, { owners: await this.registry.removeWhere(ownerFilter(url)) });
    }

    return sendProblem(response, 404, `No route ${request.method} /sandboxes`);
  }

  private async member(request: IncomingMessage, response: ServerResponse, parts: string[], url: URL): Promise<void> {
    const sandbox = this.registry.find(parts[1]);

    if (!sandbox.ok) {
      return sendProblem(response, 404, sandbox.reason);
    }

    if (request.method === "DELETE" && parts.length === 2) {
      return sendJson(response, 200, { owners: await this.registry.removeWhere((candidate) => candidate === sandbox.value) });
    }

    const action = SANDBOX_ACTIONS[request.method ?? ""]?.[parts[2] ?? ""];

    if (!action) {
      return sendProblem(response, 404, `No route ${request.method} ${url.pathname}`);
    }

    return sendOutcome(response, await action(sandbox.value, request, parts, url));
  }
}

// DELETE /sandboxes takes ?owner= (one run's) or ?ownerPrefix= (every run's); without either it removes nothing.
function ownerFilter(url: URL): (sandbox: Sandbox) => boolean {
  const owner = url.searchParams.get("owner");
  const prefix = url.searchParams.get("ownerPrefix");

  if (owner) {
    return (sandbox) => sandbox.info.owner === owner;
  }

  return prefix ? (sandbox) => sandbox.info.owner.startsWith(prefix) : () => false;
}

function sendOutcome(response: ServerResponse, outcome: Outcome<unknown>): void {
  if (outcome.ok) {
    sendJson(response, 200, outcome.value);
  } else {
    sendProblem(response, 422, outcome.reason);
  }
}
