import type { ContainerCreateOptions } from "dockerode";
import { SANDBOX_EXPIRES_LABEL, SANDBOX_LABEL, SANDBOX_OWNER_LABEL, WORKSPACE } from "@powerloom/sandbox";
import type { SandboxConfig } from "../models/SandboxConfig";

const MB = 1024 * 1024;
export const SANDBOX_USER = "1000:1000";
export const SANDBOX_HOME = "/home/sandbox";

// The isolation is the enforcement (user decision 2026-10-28): no network, nothing of the host or the runner (no env,
// no mounts but its own workspace volume), not root, a read-only root, no capabilities, no privilege gain, and hard
// limits. Nothing the caller sends reaches these options except the owner and the expiry, which are labels only.
export function sandboxContainerOptions(config: SandboxConfig, id: string, owner: string, expiresAt: Date): ContainerCreateOptions {
  return {
    name: `powerloom-sandbox-${id}`,
    Image: config.image,
    Cmd: ["sleep", "infinity"],
    User: SANDBOX_USER,
    WorkingDir: WORKSPACE,
    Env: sandboxEnv(),
    Labels: { [SANDBOX_LABEL]: id, [SANDBOX_OWNER_LABEL]: owner, [SANDBOX_EXPIRES_LABEL]: expiresAt.toISOString() },
    NetworkDisabled: true,
    HostConfig: {
      NetworkMode: "none",
      Init: true,
      ReadonlyRootfs: true,
      CapDrop: ["ALL"],
      SecurityOpt: ["no-new-privileges:true"],
      Privileged: false,
      NanoCpus: config.cpus * 1e9,
      Memory: config.memoryMb * MB,
      MemorySwap: config.memoryMb * MB,
      PidsLimit: config.pidsLimit,
      Ulimits: [{ Name: "nofile", Soft: 65536, Hard: 65536 }],
      Tmpfs: { "/tmp": `rw,nosuid,nodev,size=${config.tmpMb}m`, [SANDBOX_HOME]: "rw,nosuid,nodev,size=256m,uid=1000,gid=1000" },
      // An anonymous volume: removed with the container, and filled from the image's /workspace (owned by the user).
      Mounts: [{ Type: "volume", Source: "", Target: WORKSPACE }],
      ...(config.runtime ? { Runtime: config.runtime } : {}),
    },
  };
}

// The only environment a command sees: no variable of the service or the runner.
function sandboxEnv(): string[] {
  return [
    `HOME=${SANDBOX_HOME}`,
    "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/share/dotnet",
    "LANG=C.UTF-8",
    "DOTNET_CLI_TELEMETRY_OPTOUT=1",
    "DOTNET_NOLOGO=1",
    "DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1",
    "NUGET_PACKAGES=/workspace/.packages/nuget",
    "npm_config_cache=/workspace/.packages/npm",
    "npm_config_update_notifier=false",
    "DENO_DIR=/workspace/.packages/deno",
    "GIT_AUTHOR_NAME=PowerLoom agent",
    "GIT_AUTHOR_EMAIL=agent@powerloom.local",
    "GIT_COMMITTER_NAME=PowerLoom agent",
    "GIT_COMMITTER_EMAIL=agent@powerloom.local",
  ];
}
