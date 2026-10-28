import type { CommandRequest } from "./models/CommandRequest";
import type { CommandResult } from "./models/CommandResult";
import type { EditApplied } from "./models/EditApplied";
import type { EditRequest } from "./models/EditRequest";
import type { FileWritten } from "./models/FileWritten";
import type { OpenSandboxRequest } from "./models/OpenSandboxRequest";
import type { PatchApplied } from "./models/PatchApplied";
import type { RepoUploaded } from "./models/RepoUploaded";
import type { SandboxAnswer } from "./models/SandboxAnswer";
import type { SandboxesRemoved } from "./models/SandboxesRemoved";
import type { SandboxInfo } from "./models/SandboxInfo";
import type { SandboxSummary } from "./models/SandboxSummary";
import type { SessionOutput } from "./models/SessionOutput";
import type { SessionStartRequest } from "./models/SessionStartRequest";
import type { StdinRequest } from "./models/StdinRequest";
import type { WriteFileRequest } from "./models/WriteFileRequest";

// Every call but a command answers in seconds; a command's call waits for its own timeout plus this margin.
const REQUEST_TIMEOUT_MS = 60_000;
const COMMAND_MARGIN_MS = 30_000;
// Copying a repo in streams its whole checkout.
const UPLOAD_TIMEOUT_MS = 10 * 60_000;
const MAX_PROBLEM_CHARS = 300;

// The sandbox service (apps/sandbox): the only PowerLoom service with Docker access. Every call carries its token.
export class SandboxClient {
  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  health(): Promise<SandboxAnswer<unknown>> {
    return this.call("GET", "/health");
  }

  open(request: OpenSandboxRequest): Promise<SandboxAnswer<SandboxInfo>> {
    return this.call("POST", "/sandboxes", request);
  }

  /** Copies a repo in from a tar stream of its files; the service makes it a fresh git repo with one commit. */
  uploadRepo(id: string, name: string, tar: ReadableStream<Uint8Array>, message: string): Promise<SandboxAnswer<RepoUploaded>> {
    const path = `/sandboxes/${encodeURIComponent(id)}/repos/${encodeURIComponent(name)}?message=${encodeURIComponent(message)}`;

    return this.send("PUT", path, { body: tar, contentType: "application/x-tar", timeoutMs: UPLOAD_TIMEOUT_MS });
  }

  run(id: string, request: CommandRequest): Promise<SandboxAnswer<CommandResult>> {
    return this.call("POST", `/sandboxes/${encodeURIComponent(id)}/commands`, request, request.timeoutMs + COMMAND_MARGIN_MS);
  }

  startSession(id: string, request: SessionStartRequest): Promise<SandboxAnswer<SessionOutput>> {
    return this.call("POST", `/sandboxes/${encodeURIComponent(id)}/sessions`, request, request.yieldMs + COMMAND_MARGIN_MS);
  }

  writeStdin(id: string, sessionId: string, request: StdinRequest): Promise<SandboxAnswer<SessionOutput>> {
    return this.call("POST", `/sandboxes/${encodeURIComponent(id)}/sessions/${encodeURIComponent(sessionId)}/stdin`, request, request.yieldMs + COMMAND_MARGIN_MS);
  }

  applyPatch(id: string, patch: string): Promise<SandboxAnswer<PatchApplied>> {
    return this.call("POST", `/sandboxes/${encodeURIComponent(id)}/patch`, { patch });
  }

  edit(id: string, request: EditRequest): Promise<SandboxAnswer<EditApplied>> {
    return this.call("POST", `/sandboxes/${encodeURIComponent(id)}/edit`, request);
  }

  writeFile(id: string, request: WriteFileRequest): Promise<SandboxAnswer<FileWritten>> {
    return this.call("PUT", `/sandboxes/${encodeURIComponent(id)}/files`, request);
  }

  list(ownerPrefix: string): Promise<SandboxAnswer<SandboxSummary[]>> {
    return this.call("GET", `/sandboxes?ownerPrefix=${encodeURIComponent(ownerPrefix)}`);
  }

  remove(id: string): Promise<SandboxAnswer<SandboxesRemoved>> {
    return this.call("DELETE", `/sandboxes/${encodeURIComponent(id)}`);
  }

  removeOwned(owner: string): Promise<SandboxAnswer<SandboxesRemoved>> {
    return this.call("DELETE", `/sandboxes?owner=${encodeURIComponent(owner)}`);
  }

  removeByPrefix(ownerPrefix: string): Promise<SandboxAnswer<SandboxesRemoved>> {
    return this.call("DELETE", `/sandboxes?ownerPrefix=${encodeURIComponent(ownerPrefix)}`);
  }

  private call<T>(method: string, path: string, body?: unknown, timeoutMs = REQUEST_TIMEOUT_MS): Promise<SandboxAnswer<T>> {
    const json = body === undefined ? undefined : JSON.stringify(body);

    return this.send(method, path, { body: json, contentType: json === undefined ? undefined : "application/json", timeoutMs });
  }

  private async send<T>(method: string, path: string, options: { body?: BodyInit; contentType?: string; timeoutMs: number }): Promise<SandboxAnswer<T>> {
    const headers: Record<string, string> = { Authorization: `Bearer ${this.token}` };

    if (options.contentType) {
      headers["Content-Type"] = options.contentType;
    }

    try {
      // `duplex`: a streamed body (the repo upload) needs it in Node's fetch.
      const response = await this.fetcher(`${this.url}${path}`, { method, headers, body: options.body, signal: AbortSignal.timeout(options.timeoutMs), duplex: "half" } as RequestInit);

      return await answerOf<T>(response);
    } catch (error) {
      return { ok: false, message: `The sandbox service at ${this.url} doesn't answer (${(error as Error).message}).`, failure: "failed" };
    }
  }
}

async function answerOf<T>(response: Response): Promise<SandboxAnswer<T>> {
  if (response.status === 401) {
    return { ok: false, message: "The sandbox service refused the token: SANDBOX_TOKEN must be the same for the agent-runner and the sandbox service.", failure: "denied" };
  }

  const text = await response.text();

  if (!response.ok) {
    return { ok: false, message: problemText(text, response), failure: response.status === 422 ? "refused" : "failed" };
  }

  return { ok: true, value: (text ? JSON.parse(text) : null) as T };
}

// The service answers errors as problem details; their `detail` is the sentence for the agent.
function problemText(text: string, response: Response): string {
  try {
    const problem = JSON.parse(text) as { detail?: string; title?: string };

    return problem.detail ?? problem.title ?? `${response.status} ${response.statusText}`;
  } catch {
    return `${response.status} ${response.statusText}: ${text.slice(0, MAX_PROBLEM_CHARS)}`;
  }
}
