import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { azureTokenAnswer } from "@powerloom/agents";
import type { AgentRunJob } from "@powerloom/core";
import type { AzureUserLogin } from "@powerloom/azure";
import type { DevHubCheck } from "@powerloom/devhub";
import type { SqlConnectionCheck } from "@powerloom/sql";
import type { RunnerCodex } from "./models/RunnerCodex";
import type { RunnerMaintenance } from "./RunnerMaintenance";

const NO_CODEX = "Codex isn't set up in this agent-runner: CODEX_HOME is not set (docker-compose.yml mounts agent-homes/codex there).";

// The runner's port for PowerLoom (inside the compose network, unauthenticated like web ↔ PowerLoom):
// `POST /runs {taskId, agentId, pbiId}` → 202 and the run starts now, or 409 while a run is in progress. One task at a
// time; PowerLoom asks again later. `POST /runs/stop {taskId}` → 202 and the task's run stops (keeping what it has), or
// 409 when that task isn't the one running. `POST /sql/test {connectionString}` → 200 {ok, message}: Settings' Read SQL test,
// signed in through the agents' own SQL driver, also while a run is in progress. `POST /devhub/test {url, token}` →
// 200 {ok, message}: Settings' DevHub test, from the container the agents' DevHub calls come from. `/azure/login/*`: the user's own
// device-code sign-in for Azure (start, status, sign out); the runner keeps the token cache. `GET /azure/token`: the `az` shim's
// question for the Azure MCP server, a token of that sign-in for one API; only with the secret the shim was given. `/codex/*`: Connect Codex in Settings → AI providers
// (status, device sign-in start and status, disconnect, a login file upload); the runner owns PowerLoom's Codex home.
// `GET /health` for PowerLoom's health check and Docker's.
export class RunnerServer {
  private running: string | null = null;
  private stopper: AbortController | null = null;
  private readonly server: Server;

  constructor(
    private readonly run: (job: AgentRunJob, stop: AbortSignal) => Promise<void>,
    private readonly testSql: (connectionString: string) => Promise<SqlConnectionCheck>,
    private readonly testDevHub: (url: string, token: string) => Promise<DevHubCheck>,
    private readonly azureLogin: AzureUserLogin,
    private readonly azureTokenSecret: string,
    private readonly codex: RunnerCodex | null = null,
    private readonly maintenance: RunnerMaintenance | null = null,
  ) {
    this.server = createServer((request, response) => {
      void this.handle(request, response).catch((error) => this.requestFailed(request, response, error));
    });
  }

  listen(port: number): void {
    this.server.listen(port, () => console.log(`agent-runner listening on :${port}`));
  }

  close(): Promise<void> {
    return new Promise((resolve) => this.server.close(() => resolve()));
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (request.method === "GET" && request.url === "/health") {
      answer(response, 200, { ok: true, running: this.running, maintenanceOwner: this.maintenance?.owner() ?? null });

      return;
    }

    if (request.method === "POST" && request.url === "/runs") {
      await this.start(request, response);

      return;
    }

    if ((request.method === "PUT" || request.method === "DELETE") && request.url === "/maintenance") {
      await this.setMaintenance(request, response);
      return;
    }

    if (request.method === "POST" && request.url === "/runs/stop") {
      await this.stop(request, response);
      return;
    }

    if (request.method === "POST" && request.url === "/sql/test") {
      await this.test(request, response);

      return;
    }

    if (request.method === "POST" && request.url === "/devhub/test") {
      await this.testStack(request, response);

      return;
    }

    const url = new URL(request.url ?? "/", "http://runner");

    if (request.method === "GET" && url.pathname === "/azure/token") {
      await this.token(request, response, url);

      return;
    }

    if (url.pathname.startsWith("/azure/login")) {
      await this.login(request, response, url);

      return;
    }

    if (url.pathname.startsWith("/codex/")) {
      await this.codexRoute(request, response, url);

      return;
    }

    answer(response, 404, { error: "not found" });
  }

  private async login(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
    if (request.method === "POST" && url.pathname === "/azure/login/start") {
      await this.startLogin(request, response);

      return;
    }

    if (request.method === "GET" && url.pathname === "/azure/login/status") {
      answer(response, 200, this.azureLogin.status(url.searchParams.get("flowId") ?? ""));

      return;
    }

    if (request.method === "DELETE" && url.pathname === "/azure/login") {
      await this.azureLogin.signOut(vaultOf(url) ?? "");
      answer(response, 200, { ok: true });

      return;
    }

    answer(response, 404, { error: "not found" });
  }

  private async codexRoute(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
    if (!this.codex) {
      answer(response, 404, { error: NO_CODEX });

      return;
    }

    const route = `${request.method} ${url.pathname}`;

    if (route === "GET /codex/status") {
      answer(response, 200, { connected: await this.codex.home.isSignedIn() });

      return;
    }

    if (route === "POST /codex/login/start") {
      await this.startCodexLogin(this.codex, response);

      return;
    }

    if (route === "GET /codex/login/status") {
      answer(response, 200, this.codex.login.status());

      return;
    }

    if (route === "POST /codex/login/cancel") {
      answer(response, 200, this.codex.login.cancel());

      return;
    }

    if (route === "DELETE /codex/login") {
      await this.codex.login.signOut();
      answer(response, 200, { ok: true });

      return;
    }

    if (route === "PUT /codex/login-file") {
      await this.saveCodexLoginFile(this.codex, request, response);

      return;
    }

    answer(response, 404, { error: "not found" });
  }

  // The link and code come back at once; a CLI that ends first (device codes switched off, no network) is the answer.
  private async startCodexLogin(codex: RunnerCodex, response: ServerResponse): Promise<void> {
    try {
      answer(response, 200, await codex.login.start());
    } catch (error) {
      answer(response, 502, { error: (error as Error).message });
    }
  }

  private async saveCodexLoginFile(codex: RunnerCodex, request: IncomingMessage, response: ServerResponse): Promise<void> {
    const body = (await readBody(request)) as { authJson?: unknown } | null;

    if (typeof body?.authJson !== "string") {
      answer(response, 400, { error: "expected {authJson}" });

      return;
    }

    try {
      await codex.home.saveLoginFile(body.authJson);
      answer(response, 200, { ok: true });
    } catch (error) {
      answer(response, 400, { error: (error as Error).message });
    }
  }

  // The `az` shim's question for the Azure MCP server a run started: answered from the vault's sign-in.
  private async token(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
    const { status, body } = await azureTokenAnswer(this.azureLogin, url, request.headers.authorization, this.azureTokenSecret);

    answer(response, status, body);
  }

  // Entra's code comes back at once; a refusal before that (a blocked client id, no network) is the answer.
  private async startLogin(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const body = (await readBody(request)) as { vault?: unknown } | null;

    if (typeof body?.vault !== "string" || body.vault.length === 0) {
      answer(response, 400, { error: "expected {vault}" });

      return;
    }

    try {
      answer(response, 200, await this.azureLogin.start(body.vault));
    } catch (error) {
      answer(response, 502, { error: `Entra refused the sign-in: ${(error as Error).message}` });
    }
  }

  private async start(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const job = jobOf(await readBody(request));

    if (!job) {
      answer(response, 400, { error: "expected {taskId, agentId, pbiId}" });

      return;
    }

    if (this.maintenance?.owner()) {
      answer(response, 409, { error: "deployment maintenance; retry the job later" });
      return;
    }

    if (this.running) {
      answer(response, 409, { error: `running ${this.running}` });

      return;
    }

    this.running = job.taskId;
    this.stopper = new AbortController();
    try { answer(response, 202, { taskId: job.taskId }); }
    finally { void this.runThenFree(job, this.stopper.signal); }
  }

  private async stop(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const body = await readBody(request) as { taskId?: unknown } | null;
    if (typeof body?.taskId !== "string" || body.taskId.length === 0) {
      answer(response, 400, { error: "expected {taskId}" });
      return;
    }
    if (this.running !== body.taskId || !this.stopper) {
      answer(response, 409, { error: this.running ? `running ${this.running}, not ${body.taskId}` : "no run in progress" });
      return;
    }
    this.stopper.abort();
    answer(response, 202, { taskId: body.taskId });
  }

  private async setMaintenance(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (!this.maintenance) {
      answer(response, 503, { error: "Persistent deployment maintenance is not configured." });
      return;
    }
    const body = await readBody(request) as { owner?: unknown } | null;
    if (typeof body?.owner !== "string" || !/^[a-f0-9-]{36}$/.test(body.owner)) {
      answer(response, 400, { error: "expected a deployment owner UUID" });
      return;
    }
    const accepted = request.method === "PUT" ? this.maintenance.acquire(body.owner) : this.maintenance.release(body.owner);
    answer(response, accepted ? 200 : 409, accepted
      ? { owner: body.owner, running: this.running }
      : { error: "Another deployment owns maintenance; its lease was preserved." });
  }

  private async test(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const body = (await readBody(request)) as { connectionString?: unknown } | null;

    if (typeof body?.connectionString !== "string" || body.connectionString.trim().length === 0) {
      answer(response, 400, { error: "expected {connectionString}" });

      return;
    }

    answer(response, 200, await this.testSql(body.connectionString));
  }

  private async testStack(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const body = (await readBody(request)) as { url?: unknown; token?: unknown } | null;

    if (typeof body?.url !== "string" || typeof body.token !== "string") {
      answer(response, 400, { error: "expected {url, token}" });

      return;
    }

    answer(response, 200, await this.testDevHub(body.url, body.token));
  }

  private async runThenFree(job: AgentRunJob, stop: AbortSignal): Promise<void> {
    try {
      await this.run(job, stop);
    } catch (error) {
      console.error(`${job.taskId}: background run failed:`, error);
    } finally {
      this.running = null;
      this.stopper = null;
    }
  }

  private requestFailed(request: IncomingMessage, response: ServerResponse, error: unknown): void {
    console.error(`agent-runner request failed (${request.method} ${request.url}):`, error);
    if (response.destroyed || response.writableEnded) return;
    if (response.headersSent || request.aborted) {
      response.destroy();
      return;
    }
    try { answer(response, 500, { error: "Agent-runner request failed." }); }
    catch { response.destroy(); }
  }
}

// The request's JSON body; null when it isn't JSON.
async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(chunk as Buffer);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}

function jobOf(value: unknown): AgentRunJob | null {
  const body = (value ?? {}) as Partial<AgentRunJob>;

  return typeof body.taskId === "string" && typeof body.agentId === "string" ? { taskId: body.taskId, agentId: body.agentId, pbiId: typeof body.pbiId === "number" ? body.pbiId : null } : null;
}

function vaultOf(url: URL): string | null {
  const vault = url.searchParams.get("vault");

  return vault && vault.length > 0 ? vault : null;
}

function answer(response: ServerResponse, status: number, body: object): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}
