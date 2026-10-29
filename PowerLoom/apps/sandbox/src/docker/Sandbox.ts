import type Docker from "dockerode";
import type { SandboxInfo } from "@powerloom/sandbox";
import { ContainerFileStore } from "../files/ContainerFileStore";
import { FileEditor } from "../files/FileEditor";
import type { PackagesVolume } from "../models/PackagesVolume";
import type { SandboxConfig } from "../models/SandboxConfig";
import { SessionRegistry } from "../sessions/SessionRegistry";
import { CommandRunner } from "./CommandRunner";
import { ContainerExec } from "./ContainerExec";
import { DiskWatch } from "./DiskWatch";
import { PackageRestore } from "./PackageRestore";
import { RepoImporter } from "./RepoImporter";
import type { RestoreQueue } from "./RestoreQueue";

// One run's sandbox: its container, and what works on it.
export class Sandbox {
  readonly commands: CommandRunner;
  readonly files: FileEditor;
  readonly repos: RepoImporter;
  readonly packages: PackageRestore;

  constructor(
    readonly info: SandboxInfo,
    readonly containerId: string,
    readonly packagesVolume: PackagesVolume,
    docker: Docker,
    config: SandboxConfig,
    restores: RestoreQueue,
  ) {
    const exec = new ContainerExec(docker, containerId);

    this.commands = new CommandRunner(exec, new DiskWatch(exec, config.diskMb), new SessionRegistry(config.maxSessions), config.maxCommandMs);
    this.files = new FileEditor(new ContainerFileStore(exec));
    this.repos = new RepoImporter(exec);
    this.packages = new PackageRestore(docker, config, restores, packagesVolume.name);
  }

  get isExpired(): boolean {
    return Date.parse(this.info.expiresAt) <= Date.now();
  }
}
