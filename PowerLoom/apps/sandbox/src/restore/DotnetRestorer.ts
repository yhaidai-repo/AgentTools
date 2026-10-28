import type { RepoProbe } from "../models/RepoProbe";
import type { RestorePlan } from "../models/RestorePlan";
import type { Restorer } from "../models/Restorer";

const SOLUTION = /\.(sln|slnx)$/i;
const PROJECT = /\.(csproj|fsproj|vbproj)$/i;

// .NET: the named solution or project, else the folder's solutions, else its projects; plus the repo's local tools.
// A packages.lock.json makes NuGet keep exactly its versions.
export class DotnetRestorer implements Restorer {
  plan(probe: RepoProbe): RestorePlan {
    const targets = probe.file ? [probe.file].filter((file) => SOLUTION.test(file) || PROJECT.test(file)) : folderTargets(probe.files);
    const locked = probe.files.includes("packages.lock.json") ? ["--locked-mode"] : [];
    const steps = targets.map((target) => ({ label: `dotnet restore ${target}`, ecosystem: "dotnet" as const, argv: ["dotnet", "restore", target, ...locked], cwd: probe.folder }));
    const tools = probe.hasDotnetTools ? [{ label: "dotnet tool restore", ecosystem: "dotnet" as const, argv: ["dotnet", "tool", "restore"], cwd: probe.folder }] : [];

    return { steps: [...steps, ...tools], skipped: [] };
  }
}

function folderTargets(files: string[]): string[] {
  const solutions = files.filter((file) => SOLUTION.test(file));

  return solutions.length > 0 ? solutions : files.filter((file) => PROJECT.test(file));
}
