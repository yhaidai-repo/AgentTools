import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AgentRunJob } from "@powerloom/core";
import type { AzureIdentity, AzureIdentityCheck } from "@powerloom/azure";
import type { SqlConnectionCheck } from "@powerloom/sql";

// The runner's port for PowerLoom (inside the compose network, unauthenticated like web ↔ PowerLoom):
// `POST /runs {taskId, agentId, pbiId}` → 202 and the run starts now, or 409 while a run is in progress. One task at a
// time; PowerLoom asks again later. `POST /sql/test {connectionString}` → 200 {ok, message}: Settings' Read SQL test,
// signed in through the agents' own SQL driver, also while a run is in progress. `POST /azure/test {tenantId, clientId,
// clientSecret}` → 200 {ok, message}: Settings' Read Azure sign-in test. `GET /health` for PowerLoom's health check
// and Docker's.
export class RunnerServer {
  private running: string | null = null;
  private readonly server: Server;

  constructor(
    private readonly run: (job: AgentRunJob) => Promise<void>,
    private readonly testSql: (connectionString: string) => Promise<SqlConnectionCheck>,
    private readonly testAzure: (identity: AzureIdentity) => Promise<AzureIdentityCheck>,
  ) {
    this.server = createServer((request, response) => this.handle(request, response));
  }

  listen(port: number): void {
    this.server.listen(port, () => console.log(`agent-runner listening on :${port}`));
  }

  close(): Promise<void> {
    return new Promise((resolve) => this.server.close(() => resolve()));
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (request.method === "GET" && request.url === "/health") {
      answer(response, 200, { ok: true, running: this.running });

      return;
    }

    if (request.method === "POST" && request.url === "/runs") {
      await this.start(request, response);

      return;
    }

    if (request.method === "POST" && request.url === "/sql/test") {
      await this.test(request, response);

      return;
    }

    if (request.method === "POST" && request.url === "/azure/test") {
      await this.testIdentity(request, response);

      return;
    }

    answer(response, 404, { error: "not found" });
  }

  private async start(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const job = jobOf(await readBody(request));

    if (!job) {
      answer(response, 400, { error: "expected {taskId, agentId, pbiId}" });

      return;
    }

    if (this.running) {
      answer(response, 409, { error: `running ${this.running}` });

      return;
    }

    this.running = job.taskId;
    answer(response, 202, { taskId: job.taskId });
    void this.runThenFree(job);
  }

  private async test(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const body = (await readBody(request)) as { connectionString?: unknown } | null;

    if (typeof body?.connectionString !== "string" || body.connectionString.trim().length === 0) {
      answer(response, 400, { error: "expected {connectionString}" });

      return;
    }

    answer(response, 200, await this.testSql(body.connectionString));
  }

  private async testIdentity(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const identity = identityOf(await readBody(request));

    if (!identity) {
      answer(response, 400, { error: "expected {tenantId, clientId, clientSecret}" });

      return;
    }

    answer(response, 200, await this.testAzure(identity));
  }

  private async runThenFree(job: AgentRunJob): Promise<void> {
    try {
      await this.run(job);
    } finally {
      this.running = null;
    }
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

function identityOf(value: unknown): AzureIdentity | null {
  const body = (value ?? {}) as Partial<AzureIdentity>;
  const complete = [body.tenantId, body.clientId, body.clientSecret].every((field) => typeof field === "string" && field.trim().length > 0);

  return complete ? { tenantId: body.tenantId!.trim(), clientId: body.clientId!.trim(), clientSecret: body.clientSecret! } : null;
}

function answer(response: ServerResponse, status: number, body: object): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}
