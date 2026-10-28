import type Docker from "dockerode";
import type { SandboxInfo } from "@powerloom/sandbox";
import { ContainerFileStore } from "../files/ContainerFileStore";
import { FileEditor } from "../files/FileEditor";
import type { SandboxConfig } from "../models/SandboxConfig";
import { SessionRegistry } from "../sessions/SessionRegistry";
import { CommandRunner } from "./CommandRunner";
import { ContainerExec } from "./ContainerExec";
import { DiskWatch } from "./DiskWatch";
import { RepoImporter } from "./RepoImporter";

// One run's sandbox: its container, and what works on it.
export class Sandbox {
  readonly commands: CommandRunner;
  readonly files: FileEditor;
  readonly repos: RepoImporter;

  constructor(
    readonly info: SandboxInfo,
    readonly containerId: string,
    docker: Docker,
    config: SandboxConfig,
  ) {
    const exec = new ContainerExec(docker, containerId);

    this.commands = new CommandRunner(exec, new DiskWatch(exec, config.diskMb), new SessionRegistry(config.maxSessions), config.maxCommandMs);
    this.files = new FileEditor(new ContainerFileStore(exec));
    this.repos = new RepoImporter(exec);
  }

  get isExpired(): boolean {
    return Date.parse(this.info.expiresAt) <= Date.now();
  }
}
