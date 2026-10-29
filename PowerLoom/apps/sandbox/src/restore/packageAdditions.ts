import { posix } from "node:path";
import type { PackageAddition } from "@powerloom/sandbox";
import type { Outcome } from "../models/Outcome";
import type { RestoreStep } from "../models/RestoreStep";
import { restoreTarget } from "./probeRepo";

const PROJECT = /\.(csproj|fsproj|vbproj)$/i;
// NuGet's own rules for an id and a version; nothing in them can start an option or leave the argument.
const PACKAGE_ID = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,99}$/;
const VERSION = /^[0-9][0-9A-Za-z.+-]{0,63}$/;

// `dotnet add package` needs the network, so it runs only inside a restore (run_command refuses it): the package lands
// in the cache with the feeds' sign-ins, and the agent then references it in its own copy, where the build finds it
// offline. The project file the restore changed is thrown away with the restore's container.
export function additionSteps(repoRoot: string, additions: PackageAddition[]): Outcome<RestoreStep[]> {
  const invalid = additions.map((addition) => problemWith(repoRoot, addition)).find((problem) => problem !== null);

  if (invalid) {
    return { ok: false, reason: invalid };
  }

  return { ok: true, value: additions.map((addition) => stepOf(repoRoot, addition)) };
}

function problemWith(repoRoot: string, addition: PackageAddition): string | null {
  if (!isProjectInRepo(repoRoot, addition.project)) {
    return `"${addition.project}" is not a .csproj, .fsproj or .vbproj inside the repo`;
  }

  if (!PACKAGE_ID.test(addition.id ?? "")) {
    return `"${addition.id}" is not a NuGet package id`;
  }

  return addition.version === undefined || VERSION.test(addition.version) ? null : `"${addition.version}" is not a NuGet version`;
}

function isProjectInRepo(repoRoot: string, project: string | undefined): boolean {
  const trimmed = (project ?? "").trim();

  return PROJECT.test(trimmed) && !trimmed.startsWith("-") && restoreTarget(repoRoot, trimmed).ok;
}

function stepOf(repoRoot: string, addition: PackageAddition): RestoreStep {
  const project = posix.normalize(addition.project.trim());
  const version = addition.version ? ["--version", addition.version] : [];
  const label = `dotnet add ${project} package ${addition.id}${addition.version ? ` --version ${addition.version}` : ""}`;

  return { label, ecosystem: "dotnet", argv: ["dotnet", "add", project, "package", addition.id, ...version], cwd: repoRoot };
}
