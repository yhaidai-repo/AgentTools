import { posix } from "node:path";
import type { ContainerExec } from "../docker/ContainerExec";
import type { Outcome } from "../models/Outcome";
import type { RepoProbe } from "../models/RepoProbe";

const PROBE_DEADLINE_MS = 60_000;
const BUILD_FILE = /\.(sln|slnx|csproj|fsproj|vbproj)$/i;

/** Where a restore runs: the repo root, a folder of it, or the folder of a named solution or project. */
export function restoreTarget(repoRoot: string, target: string): Outcome<{ folder: string; file: string | null }> {
  const relative = posix.normalize(target.trim() || ".");

  if (posix.isAbsolute(relative) || relative.startsWith("..")) {
    return { ok: false, reason: `"${target}" must be a path inside the repo` };
  }

  if (!BUILD_FILE.test(relative)) {
    return { ok: true, value: { folder: posix.join(repoRoot, relative), file: null } };
  }

  return { ok: true, value: { folder: posix.join(repoRoot, posix.dirname(relative)), file: posix.basename(relative) } };
}

/** Reads what decides the restore, from the unchanged copy in the restore container. */
export async function probeRepo(exec: ContainerExec, repoRoot: string, folder: string, file: string | null): Promise<Outcome<RepoProbe>> {
  const listing = await exec.run(["ls", "-1A", "--", folder], { deadlineMs: PROBE_DEADLINE_MS });

  if (listing.exitCode !== 0) {
    return { ok: false, reason: `${posix.relative(repoRoot, folder) || "."} is not a folder of the repo` };
  }

  const files = listing.stdout.toString("utf8").split("\n").filter(Boolean);

  if (file !== null && !files.includes(file)) {
    return { ok: false, reason: `${file} is not in ${posix.relative(repoRoot, folder) || "the repo's root"}` };
  }

  return {
    ok: true,
    value: {
      folder,
      file,
      files,
      hasDotnetTools: (await readText(exec, posix.join(repoRoot, ".config/dotnet-tools.json"))) !== null,
      override: await readText(exec, posix.join(repoRoot, ".powerloom/sandbox.json")),
      npmrc: await readText(exec, posix.join(folder, ".npmrc")),
    },
  };
}

async function readText(exec: ContainerExec, path: string): Promise<string | null> {
  const result = await exec.run(["cat", "--", path], { deadlineMs: PROBE_DEADLINE_MS });

  return result.exitCode === 0 ? result.stdout.toString("utf8") : null;
}
