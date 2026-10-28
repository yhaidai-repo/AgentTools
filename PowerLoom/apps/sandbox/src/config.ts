import type { SandboxConfig } from "./models/SandboxConfig";

export function configFromEnv(): SandboxConfig {
  const docker = new URL((process.env.DOCKER_HOST ?? "tcp://docker-proxy:2375").replace(/^tcp:/, "http:"));

  return {
    token: required("SANDBOX_TOKEN"),
    port: number("SANDBOX_PORT", 3300),
    dockerHost: docker.hostname,
    dockerPort: Number(docker.port || 2375),
    image: process.env.SANDBOX_IMAGE || "powerloom-sandbox",
    runtime: process.env.SANDBOX_RUNTIME || null,
    cpus: number("SANDBOX_CPUS", 4),
    memoryMb: number("SANDBOX_MEMORY_MB", 8192),
    pidsLimit: number("SANDBOX_PIDS", 1024),
    diskMb: number("SANDBOX_DISK_MB", 20480),
    tmpMb: number("SANDBOX_TMP_MB", 1024),
    maxCommandMs: number("SANDBOX_MAX_COMMAND_MS", 600_000),
    maxSessions: number("SANDBOX_MAX_SESSIONS", 8),
  };
}

function required(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not set`);
  }

  return value;
}

function number(name: string, fallback: number): number {
  const value = Number(process.env[name]);

  return Number.isFinite(value) && value > 0 ? value : fallback;
}
