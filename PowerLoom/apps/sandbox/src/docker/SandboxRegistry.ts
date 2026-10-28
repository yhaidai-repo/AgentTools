import { randomBytes } from "node:crypto";
import type Docker from "dockerode";
import { SANDBOX_LABEL, SANDBOX_OWNER_LABEL, WORKSPACE, type OpenSandboxRequest, type SandboxSummary } from "@powerloom/sandbox";
import type { Outcome } from "../models/Outcome";
import type { SandboxConfig } from "../models/SandboxConfig";
import { Sandbox } from "./Sandbox";
import { sandboxContainerOptions } from "./sandboxContainerOptions";

const TOOLCHAINS_LABEL = "powerloom.toolchains";
const MAX_TTL_MINUTES = 24 * 60;

// The open sandboxes, in memory: the service removes every sandbox container at its start (removeLeftovers), so a
// container always has its entry here, and a sandbox never outlives its expiry (reap).
export class SandboxRegistry {
  private readonly sandboxes = new Map<string, Sandbox>();
  private toolchains: string | null = null;

  constructor(
    private readonly docker: Docker,
    private readonly config: SandboxConfig,
  ) {}

  async open(request: OpenSandboxRequest): Promise<Sandbox> {
    const id = randomBytes(6).toString("hex");
    const expiresAt = new Date(Date.now() + Math.min(request.ttlMinutes, MAX_TTL_MINUTES) * 60_000);
    const container = await this.docker.createContainer(sandboxContainerOptions(this.config, id, request.owner, expiresAt));

    await container.start();

    const info = { id, owner: request.owner, expiresAt: expiresAt.toISOString(), workspace: WORKSPACE, image: this.config.image, toolchains: await this.imageToolchains() };
    const sandbox = new Sandbox(info, container.id, this.docker, this.config);

    this.sandboxes.set(id, sandbox);

    return sandbox;
  }

  find(id: string): Outcome<Sandbox> {
    const sandbox = this.sandboxes.get(id);

    return sandbox ? { ok: true, value: sandbox } : { ok: false, reason: `No sandbox ${id}: it was closed, it expired, or the sandbox service restarted. Open a new one with sandbox_open.` };
  }

  list(ownerPrefix: string): SandboxSummary[] {
    return [...this.sandboxes.values()].filter((sandbox) => sandbox.info.owner.startsWith(ownerPrefix)).map(({ info }) => ({ id: info.id, owner: info.owner, expiresAt: info.expiresAt }));
  }

  /** Removes the sandboxes `isGone` picks; returns their owners. */
  async removeWhere(isGone: (sandbox: Sandbox) => boolean): Promise<string[]> {
    const gone = [...this.sandboxes.values()].filter(isGone);

    for (const sandbox of gone) {
      await this.remove(sandbox);
    }

    return gone.map((sandbox) => sandbox.info.owner);
  }

  reap(): Promise<string[]> {
    return this.removeWhere((sandbox) => sandbox.isExpired);
  }

  /** At the service's start: containers of an earlier start have no sessions or entry here any more. */
  async removeLeftovers(): Promise<number> {
    const containers = await this.docker.listContainers({ all: true, filters: { label: [SANDBOX_LABEL] } });

    for (const container of containers) {
      await this.docker.getContainer(container.Id).remove({ force: true, v: true });
      console.log(`removed the leftover sandbox of ${container.Labels[SANDBOX_OWNER_LABEL] ?? "unknown"}`);
    }

    return containers.length;
  }

  private async remove(sandbox: Sandbox): Promise<void> {
    this.sandboxes.delete(sandbox.info.id);
    sandbox.commands.closeSessions();

    try {
      await this.docker.getContainer(sandbox.containerId).remove({ force: true, v: true });
    } catch (error) {
      console.error(`removing the sandbox of ${sandbox.info.owner} failed:`, error);
    }
  }

  private async imageToolchains(): Promise<string> {
    if (this.toolchains === null) {
      const image = await this.docker.getImage(this.config.image).inspect();

      this.toolchains = image.Config?.Labels?.[TOOLCHAINS_LABEL] ?? "";
    }

    return this.toolchains;
  }
}
