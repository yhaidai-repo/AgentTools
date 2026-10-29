import assert from "node:assert/strict";
import { test } from "node:test";
import { PACKAGES } from "@powerloom/sandbox";
import type { SandboxConfig } from "../models/SandboxConfig";
import { packagesVolumeOf } from "./packagesVolume";
import { RestoreQueue } from "./RestoreQueue";
import { NUGET_TMP, restoreContainerOptions, sandboxContainerOptions } from "./sandboxContainerOptions";

const config = { cpus: 2, memoryMb: 1024, pidsLimit: 100, tmpMb: 64, runtime: null, egressNetwork: "sandbox-egress" } as SandboxConfig;
const expiresAt = new Date("2026-10-29T12:00:00Z");

test("sandboxes of one vault share its cache; a sandbox without a key gets a volume of its own", () => {
  const first = packagesVolumeOf("aaa111", "Team Vault");
  const second = packagesVolumeOf("bbb222", "Team Vault");
  const other = packagesVolumeOf("ccc333", "team-vault");
  const own = packagesVolumeOf("ddd444", undefined);

  assert.equal(first.name, second.name);
  assert.equal(first.shared, true);
  assert.match(first.name, /^powerloom-packages-team-vault-[0-9a-f]{10}$/);
  assert.notEqual(first.name, other.name);
  assert.deepEqual(own, { name: "powerloom-sandbox-ddd444-packages", shared: false });
});

test("a command reads the cache read-only and offline; a restore writes it through the proxy", () => {
  const sandbox = sandboxContainerOptions(config, "powerloom-sandbox", "powerloom-packages-v-1", "aaa111", "powerloom-run-1", expiresAt);
  const restore = restoreContainerOptions(config, "powerloom-sandbox", "http://sandbox-egress:3128", "powerloom-packages-v-1", "aaa111", "powerloom-run-1", expiresAt);

  assert.deepEqual(sandbox.HostConfig?.Mounts?.[1], { Type: "volume", Source: "powerloom-packages-v-1", Target: PACKAGES, ReadOnly: true });
  assert.ok(sandbox.Env?.includes(`RestoreSources=${PACKAGES}/nuget`));
  assert.ok(sandbox.Env?.includes("NuGetAudit=false"));
  assert.equal(sandbox.HostConfig?.NetworkMode, "none");
  assert.deepEqual(restore.HostConfig?.Mounts?.[1], { Type: "volume", Source: "powerloom-packages-v-1", Target: PACKAGES });
  assert.equal(restore.Env?.some((entry) => entry.startsWith("RestoreSources=")), false);
});

test("a restore keeps NuGet's download caches on /tmp, bounded by tmpMb, and its packages on the volume", () => {
  const restore = restoreContainerOptions(config, "powerloom-sandbox", "http://sandbox-egress:3128", "powerloom-packages-v-1", "aaa111", "powerloom-run-1", expiresAt);
  const env = restore.Env ?? [];

  assert.ok(env.includes(`NUGET_PACKAGES=${PACKAGES}/nuget`));
  assert.ok(env.includes(`npm_config_cache=${PACKAGES}/npm`));
  assert.ok(env.includes(`NUGET_HTTP_CACHE_PATH=${NUGET_TMP}/http-cache`));
  assert.ok(env.includes(`NUGET_PLUGINS_CACHE_PATH=${NUGET_TMP}/plugins-cache`));
  assert.ok(env.includes(`NUGET_SCRATCH=${NUGET_TMP}/scratch`));
  assert.match(NUGET_TMP, /^\/tmp\//);
  assert.equal(restore.HostConfig?.Tmpfs?.["/tmp"], "rw,nosuid,nodev,size=64m");
});

test("restores of one cache take turns; other caches don't wait", async () => {
  const queue = new RestoreQueue();
  const order: string[] = [];
  let releaseFirst = () => {};
  const first = queue.run("a", () => new Promise<void>((resolve) => { releaseFirst = () => { order.push("a1"); resolve(); }; }));
  const second = queue.run("a", async () => { order.push("a2"); });
  const other = queue.run("b", async () => { order.push("b1"); });

  await other;
  releaseFirst();
  await Promise.all([first, second]);

  assert.deepEqual(order, ["b1", "a1", "a2"]);
});

test("a failed restore doesn't stop the next one of its cache", async () => {
  const queue = new RestoreQueue();
  const failed = queue.run("a", async () => { throw new Error("feed down"); });
  const next = queue.run("a", async () => "restored");

  await assert.rejects(failed, /feed down/);
  assert.equal(await next, "restored");
});
