import type { ContainerCreateOptions, HostConfig } from "dockerode";
import { PACKAGES, SANDBOX_EXPIRES_LABEL, SANDBOX_LABEL, SANDBOX_OWNER_LABEL, WORKSPACE } from "@powerloom/sandbox";
import type { SandboxConfig } from "../models/SandboxConfig";

const MB = 1024 * 1024;
export const SANDBOX_USER = "1000:1000";
export const SANDBOX_HOME = "/home/sandbox";
export const RESTORE_WORK = "/work";

/** The sandbox's packages volume: written by its restores, read-only for its commands. */
export function packagesVolume(id: string): string {
  return `powerloom-sandbox-${id}-packages`;
}

// The isolation is the enforcement (user decision 2026-10-28): no network, nothing of the host or the runner (no env,
// no mounts but its own volumes), not root, a read-only root, no capabilities, no privilege gain, and hard limits.
// Nothing the caller sends reaches these options except the owner and the expiry, which are labels only.
export function sandboxContainerOptions(config: SandboxConfig, image: string, id: string, owner: string, expiresAt: Date): ContainerCreateOptions {
  return {
    name: `powerloom-sandbox-${id}`,
    Image: image,
    Cmd: ["sleep", "infinity"],
    User: SANDBOX_USER,
    WorkingDir: WORKSPACE,
    Env: sandboxEnv(),
    Labels: labels(id, owner, expiresAt),
    NetworkDisabled: true,
    HostConfig: {
      ...isolation(config),
      NetworkMode: "none",
      // An anonymous workspace volume, removed with the container and filled from the image's /workspace (owned by the
      // user); the packages volume read-only.
      Mounts: [{ Type: "volume", Source: "", Target: WORKSPACE }, { Type: "volume", Source: packagesVolume(id), Target: PACKAGES, ReadOnly: true }],
    },
  };
}

// A restore's container (phase 3): the same isolation and the sandbox's image, but on the egress network (its only way
// out is the proxy, reached at `proxyUrl` with the restore's pass), with the repo's unchanged copy in its own volume and
// the sandbox's packages volume writable. Lives for one restore.
export function restoreContainerOptions(config: SandboxConfig, image: string, proxyUrl: string, id: string, owner: string, expiresAt: Date): ContainerCreateOptions {
  return {
    name: `powerloom-restore-${id}-${Date.now()}`,
    Image: image,
    Cmd: ["sleep", "infinity"],
    User: SANDBOX_USER,
    WorkingDir: RESTORE_WORK,
    // NuGet checks package signatures' revocation over plain HTTP (CRL/OCSP), which the proxy refuses: offline mode
    // skips those calls instead of letting each one fail.
    Env: [...sandboxEnv(), "NUGET_CERT_REVOCATION_MODE=offline", `HTTPS_PROXY=${proxyUrl}`, `https_proxy=${proxyUrl}`, `HTTP_PROXY=${proxyUrl}`, `http_proxy=${proxyUrl}`, "NO_PROXY=localhost,127.0.0.1"],
    Labels: labels(id, owner, expiresAt),
    HostConfig: {
      ...isolation(config),
      NetworkMode: config.egressNetwork ?? "none",
      Mounts: [{ Type: "volume", Source: "", Target: RESTORE_WORK }, { Type: "volume", Source: packagesVolume(id), Target: PACKAGES }],
    },
  };
}

function isolation(config: SandboxConfig): HostConfig {
  return {
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
    ...(config.runtime ? { Runtime: config.runtime } : {}),
  };
}

function labels(id: string, owner: string, expiresAt: Date): Record<string, string> {
  return { [SANDBOX_LABEL]: id, [SANDBOX_OWNER_LABEL]: owner, [SANDBOX_EXPIRES_LABEL]: expiresAt.toISOString() };
}

// The only environment a command sees: no variable of the service or the runner. Package caches point at the packages
// volume, so a build finds what its restore fetched without a network.
function sandboxEnv(): string[] {
  return [
    `HOME=${SANDBOX_HOME}`,
    "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/share/dotnet",
    "LANG=C.UTF-8",
    "DOTNET_CLI_TELEMETRY_OPTOUT=1",
    "DOTNET_NOLOGO=1",
    "DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1",
    `NUGET_PACKAGES=${PACKAGES}/nuget`,
    `npm_config_cache=${PACKAGES}/npm`,
    "npm_config_update_notifier=false",
    `DENO_DIR=${PACKAGES}/deno`,
    "GIT_AUTHOR_NAME=PowerLoom agent",
    "GIT_AUTHOR_EMAIL=agent@powerloom.local",
    "GIT_COMMITTER_NAME=PowerLoom agent",
    "GIT_COMMITTER_EMAIL=agent@powerloom.local",
  ];
}
