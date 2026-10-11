import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AgentRunJob } from "@powerloom/core";

// The runner's port for PowerLoom (inside the compose network, unauthenticated like web ↔ PowerLoom):
// `POST /runs {taskId, agentId, pbiId}` → 202 and the run starts now, or 409 while a run is in progress. One task at a
// time; PowerLoom asks again later. `GET /health` for PowerLoom's health check and Docker's.
export class RunnerServer {
  private running: string | null = null;
  private readonly server: Server;

  constructor(private readonly run: (job: AgentRunJob) => Promise<void>) {
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

    if (request.method !== "POST" || request.url !== "/runs") {
      answer(response, 404, { error: "not found" });

      return;
    }

    const job = await readJob(request);

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

  private async runThenFree(job: AgentRunJob): Promise<void> {
    try {
      await this.run(job);
    } finally {
      this.running = null;
    }
  }
}

async function readJob(request: IncomingMessage): Promise<AgentRunJob | null> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(chunk as Buffer);
  }

  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Partial<AgentRunJob>;

    return typeof body.taskId === "string" && typeof body.agentId === "string" ? { taskId: body.taskId, agentId: body.agentId, pbiId: typeof body.pbiId === "number" ? body.pbiId : null } : null;
  } catch {
    return null;
  }
}

function answer(response: ServerResponse, status: number, body: object): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}
