import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type Docker from "dockerode";
import { BadRequest } from "./BadRequest";
import { isAuthorized, sendJson, sendProblem } from "./httpIo";
import type { SandboxRoutes } from "./SandboxRoutes";

// The service's HTTP side: /health without a token (the compose healthcheck), everything else with it.
export class SandboxHttpServer {
  private readonly server: Server;

  constructor(
    private readonly routes: SandboxRoutes,
    private readonly docker: Docker,
    private readonly token: string,
  ) {
    this.server = createServer((request, response) => void this.serve(request, response));
  }

  listen(port: number): void {
    this.server.listen(port);
  }

  close(): Promise<void> {
    return new Promise((resolve) => this.server.close(() => resolve()));
  }

  private async serve(request: IncomingMessage, response: ServerResponse): Promise<void> {
    try {
      await this.answer(request, response);
    } catch (error) {
      answerError(response, error);
    }
  }

  private async answer(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (request.url === "/health") {
      return this.health(response);
    }

    if (!isAuthorized(request, this.token)) {
      return sendProblem(response, 401, "The sandbox token is missing or wrong");
    }

    return this.routes.handle(request, response);
  }

  private async health(response: ServerResponse): Promise<void> {
    await this.docker.ping();

    sendJson(response, 200, { ok: true });
  }
}

// Docker answers 409 to an exec in a container that is no longer running.
function isStoppedContainer(error: unknown): boolean {
  return (error as { statusCode?: number } | null)?.statusCode === 409;
}

function answerError(response: ServerResponse, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);

  if (error instanceof BadRequest || error instanceof SyntaxError) {
    sendProblem(response, 400, message);

    return;
  }

  if (isStoppedContainer(error)) {
    sendProblem(response, 410, "The sandbox has stopped: its main process ended (killing every process ends it). Close it with sandbox_close and open a new one.");

    return;
  }

  console.error("sandbox request failed:", error);

  if (!response.headersSent) {
    sendProblem(response, 500, message);
  }
}
