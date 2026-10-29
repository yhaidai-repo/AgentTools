import Docker from "dockerode";
import { configFromEnv } from "./config";
import { SandboxRegistry } from "./docker/SandboxRegistry";
import { httpServerOptions } from "./http/requestTimeouts";
import { SandboxHttpServer } from "./http/SandboxHttpServer";
import { SandboxRoutes } from "./http/SandboxRoutes";

const REAP_EVERY_MS = 60_000;

// The sandbox service (design agent-sandbox, 2026-10-28): the one PowerLoom service with Docker access (through the
// socket proxy), starting one isolated container per run for the agents' commands. The agent-runner reaches it with a
// token and never gets Docker itself.
const config = configFromEnv();
const docker = new Docker({ host: config.dockerHost, port: config.dockerPort });
const registry = new SandboxRegistry(docker, config);

await registry.removeLeftovers();

const server = new SandboxHttpServer(new SandboxRoutes(registry), docker, config.token, httpServerOptions(config));
const reaper = setInterval(() => void reapExpired(), REAP_EVERY_MS);

server.listen(config.port);
console.log(`sandbox service started on ${config.port}; images from ${config.imageCatalogPath ?? "the general image only"}${config.runtime ? `, runtime ${config.runtime}` : ""}`);

process.once("SIGTERM", stop);
process.once("SIGINT", stop);

async function reapExpired(): Promise<void> {
  try {
    const owners = await registry.reap();

    owners.forEach((owner) => console.log(`removed the expired sandbox of ${owner}`));
  } catch (error) {
    console.error("removing expired sandboxes failed:", error);
  }
}

// A stop removes every sandbox: their sessions live in this process and can't be picked up again. Removing them first
// ends the requests still waiting on a command, so the server can close.
async function stop(): Promise<void> {
  clearInterval(reaper);
  await registry.removeWhere(() => true);
  await server.close();
  process.exit(0);
}
