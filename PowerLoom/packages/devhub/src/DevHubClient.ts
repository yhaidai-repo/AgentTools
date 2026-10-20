import type { BrowserClosed } from "./models/BrowserClosed";
import type { BrowserStatus } from "./models/BrowserStatus";
import type { DevHubAnswer } from "./models/DevHubAnswer";
import type { McpEndpoint } from "./models/McpEndpoint";
import type { McpToolAnswer } from "./models/McpToolAnswer";
import type { OpenBrowserRequest } from "./models/OpenBrowserRequest";
import type { TypeSecretRequest } from "./models/TypeSecretRequest";
import type { StackLog } from "./models/StackLog";
import type { StackServiceInfo } from "./models/StackServiceInfo";
import type { StackStatus } from "./models/StackStatus";
import type { StackStopped } from "./models/StackStopped";
import type { StartStackRequest } from "./models/StartStackRequest";

// A status call starts a PowerShell script on the host and a stop waits for docker compose; both take seconds.
const REQUEST_TIMEOUT_MS = 90_000;
const DEVHUB_SCRIPT = "D:/Projects/AgentTools/DevSecrets/Start-DevHub.ps1";

// DevHub on the Windows host (DevSecrets DevHub): it runs Start-/Get-/Stop-LocalStack.ps1 for agents,
// which can't run them from Docker. Every call carries the vault's token.
export class DevHubClient {
  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  health(): Promise<DevHubAnswer<unknown>> {
    return this.call("GET", "/health");
  }

  services(): Promise<DevHubAnswer<StackServiceInfo[]>> {
    return this.call("GET", "/services");
  }

  start(request: StartStackRequest): Promise<DevHubAnswer<unknown>> {
    return this.call("POST", "/stack", request);
  }

  status(): Promise<DevHubAnswer<StackStatus>> {
    return this.call("GET", "/stack");
  }

  logs(service: string, lines: number, error: boolean): Promise<DevHubAnswer<StackLog>> {
    return this.call("GET", `/stack/logs/${encodeURIComponent(service)}?lines=${lines}&error=${error}`);
  }

  stop(owner: string): Promise<DevHubAnswer<StackStopped>> {
    return this.call("DELETE", `/stack?owner=${encodeURIComponent(owner)}`);
  }

  openBrowser(request: OpenBrowserRequest): Promise<DevHubAnswer<BrowserStatus>> {
    return this.call("POST", "/browser", request);
  }

  browserStatus(): Promise<DevHubAnswer<BrowserStatus>> {
    return this.call("GET", "/browser");
  }

  // The open case's Playwright MCP, behind DevHub's token (the MCP itself accepts only localhost).
  mcpEndpoint(): McpEndpoint {
    return { url: `${this.url}/browser/mcp`, headers: { Authorization: `Bearer ${this.token}` } };
  }

  typeSecret(request: TypeSecretRequest): Promise<DevHubAnswer<McpToolAnswer>> {
    return this.call("POST", "/browser/type-secret", request);
  }

  closeBrowser(owner: string): Promise<DevHubAnswer<BrowserClosed>> {
    return this.call("DELETE", `/browser?owner=${encodeURIComponent(owner)}`);
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<DevHubAnswer<T>> {
    const response = await this.send(method, path, body);

    if (response instanceof Error) {
      return { ok: false, message: `DevHub at ${this.url} doesn't answer (${response.message}). Someone has to start ${DEVHUB_SCRIPT} on the host.`, denied: false };
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

async function answerOf<T>(response: Response): Promise<DevHubAnswer<T>> {
  if (response.status === 401) {
    return { ok: false, message: "DevHub refused the token: the vault's DevHub token (Settings) must be the dev-secrets value dev-hub-token.", denied: true };
  }

  const text = await response.text();

  if (!response.ok) {
    return { ok: false, message: problemText(text, response), denied: false };
  }

  return { ok: true, value: (text ? JSON.parse(text) : null) as T };
}

// DevHub answers errors as problem details; their `detail` is the sentence for the agent.
function problemText(text: string, response: Response): string {
  try {
    const problem = JSON.parse(text) as { detail?: string; title?: string };

    return problem.detail ?? problem.title ?? `${response.status} ${response.statusText}`;
  } catch {
    return `${response.status} ${response.statusText}: ${text.slice(0, 300)}`;
  }
}
