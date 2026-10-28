import { randomBytes } from "node:crypto";
import type Docker from "dockerode";
import { SANDBOX_LABEL, SANDBOX_OWNER_LABEL, WORKSPACE, imageNamed, readImageCatalog, type OpenSandboxRequest, type SandboxImage, type SandboxSummary } from "@powerloom/sandbox";
import type { Outcome } from "../models/Outcome";
import type { SandboxConfig } from "../models/SandboxConfig";
import { Sandbox } from "./Sandbox";
import { packagesVolume, sandboxContainerOptions } from "./sandboxContainerOptions";

const TOOLCHAINS_LABEL = "powerloom.toolchains";
const MAX_TTL_MINUTES = 24 * 60;

// The open sandboxes, in memory: the service removes every sandbox container at its start (removeLeftovers), so a
// container always has its entry here, and a sandbox never outlives its expiry (reap).
export class SandboxRegistry {
  private readonly sandboxes = new Map<string, Sandbox>();
  // What each image holds, from its label: read once per image.
  private readonly toolchains = new Map<string, string>();
  private readonly catalog: SandboxImage[];

  constructor(
    private readonly docker: Docker,
    private readonly config: SandboxConfig,
  ) {
    this.catalog = readImageCatalog(config.imageCatalogPath ?? undefined);
  }

  /** Refused for an image name the catalog doesn't have: the caller never names a Docker image itself. */
  async open(request: OpenSandboxRequest): Promise<Outcome<Sandbox>> {
    const image = imageNamed(this.catalog, request.image ?? "");

    if (!image) {
      return { ok: false, reason: `The vault's sandbox image "${request.image}" is not in the image catalog (${this.catalog.map((entry) => entry.name).join(", ")}): pick one in Settings → Data access → Sandbox` };
    }

    return { ok: true, value: await this.start(request, image) };
  }

  private async start(request: OpenSandboxRequest, image: SandboxImage): Promise<Sandbox> {
    const id = randomBytes(6).toString("hex");
    const expiresAt = new Date(Date.now() + Math.min(request.ttlMinutes, MAX_TTL_MINUTES) * 60_000);

    await this.docker.createVolume({ Name: packagesVolume(id), Labels: { [SANDBOX_LABEL]: id, [SANDBOX_OWNER_LABEL]: request.owner } });

    const container = await this.docker.createContainer(sandboxContainerOptions(this.config, image.image, id, request.owner, expiresAt));

    await container.start();

    const info = { id, owner: request.owner, expiresAt: expiresAt.toISOString(), workspace: WORKSPACE, image: image.image, toolchains: await this.toolchainsOf(image) };
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

    const volumes = (await this.docker.listVolumes({ filters: { label: [SANDBOX_LABEL] } })).Volumes ?? [];

    for (const volume of volumes) {
      await this.docker.getVolume(volume.Name).remove();
    }

    return containers.length;
  }

  private async remove(sandbox: Sandbox): Promise<void> {
    this.sandboxes.delete(sandbox.info.id);
    sandbox.commands.closeSessions();

    try {
      await this.docker.getContainer(sandbox.containerId).remove({ force: true, v: true });
      await this.docker.getVolume(packagesVolume(sandbox.info.id)).remove();
    } catch (error) {
      console.error(`removing the sandbox of ${sandbox.info.owner} failed:`, error);
    }
  }

  // The image's own label, else the catalog's description.
  private async toolchainsOf(image: SandboxImage): Promise<string> {
    if (!this.toolchains.has(image.image)) {
      const inspected = await this.docker.getImage(image.image).inspect();

      this.toolchains.set(image.image, inspected.Config?.Labels?.[TOOLCHAINS_LABEL] ?? image.description);
    }

    return this.toolchains.get(image.image) ?? image.description;
  }
}
