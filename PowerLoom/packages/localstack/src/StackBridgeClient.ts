import type { BridgeAnswer } from "./models/BridgeAnswer";
import type { StackLog } from "./models/StackLog";
import type { StackServiceInfo } from "./models/StackServiceInfo";
import type { StackStatus } from "./models/StackStatus";
import type { StackStopped } from "./models/StackStopped";
import type { StartStackRequest } from "./models/StartStackRequest";

// A status call starts a PowerShell script on the host and a stop waits for docker compose; both take seconds.
const REQUEST_TIMEOUT_MS = 90_000;
const BRIDGE_SCRIPT = "D:/Projects/AgentTools/DevSecrets/Start-StackBridge.ps1";

// The stack bridge on the Windows host (DevSecrets StackBridge): it runs Start-/Get-/Stop-LocalStack.ps1 for agents,
// which can't run them from Docker. Every call carries the vault's token.
export class StackBridgeClient {
  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  health(): Promise<BridgeAnswer<unknown>> {
    return this.call("GET", "/health");
  }

  services(): Promise<BridgeAnswer<StackServiceInfo[]>> {
    return this.call("GET", "/services");
  }

  start(request: StartStackRequest): Promise<BridgeAnswer<unknown>> {
    return this.call("POST", "/stack", request);
  }

  status(): Promise<BridgeAnswer<StackStatus>> {
    return this.call("GET", "/stack");
  }

  logs(service: string, lines: number, error: boolean): Promise<BridgeAnswer<StackLog>> {
    return this.call("GET", `/stack/logs/${encodeURIComponent(service)}?lines=${lines}&error=${error}`);
  }

  stop(owner: string): Promise<BridgeAnswer<StackStopped>> {
    return this.call("DELETE", `/stack?owner=${encodeURIComponent(owner)}`);
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<BridgeAnswer<T>> {
    const response = await this.send(method, path, body);

    if (response instanceof Error) {
      return { ok: false, message: `The stack bridge at ${this.url} doesn't answer (${response.message}). Someone has to start ${BRIDGE_SCRIPT} on the host.`, denied: false };
    }

    return answerOf<T>(response);
  }

  private async send(method: string, path: string, body: unknown): Promise<Response | Error> {
    const headers: Record<string, string> = { Authorization: `Bearer ${this.token}` };

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    try {
      return await this.fetcher(`${this.url}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (error) {
      return error as Error;
    }
  }
}

async function answerOf<T>(response: Response): Promise<BridgeAnswer<T>> {
  if (response.status === 401) {
    return { ok: false, message: "The stack bridge refused the token: the vault's Local stack token (Settings) must be the dev-secrets value stack-bridge-token.", denied: true };
  }

  const text = await response.text();

  if (!response.ok) {
    return { ok: false, message: problemText(text, response), denied: false };
  }

  return { ok: true, value: (text ? JSON.parse(text) : null) as T };
}

// The bridge answers errors as problem details; their `detail` is the sentence for the agent.
function problemText(text: string, response: Response): string {
  try {
    const problem = JSON.parse(text) as { detail?: string; title?: string };

    return problem.detail ?? problem.title ?? `${response.status} ${response.statusText}`;
  } catch {
    return `${response.status} ${response.statusText}: ${text.slice(0, 300)}`;
  }
}
