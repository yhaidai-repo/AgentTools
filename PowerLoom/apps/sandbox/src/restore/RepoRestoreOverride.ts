import type { RepoProbe } from "../models/RepoProbe";
import type { RestorePlan } from "../models/RestorePlan";
import type { Restorer } from "../models/Restorer";

// A repo decides its own restore with a committed .powerloom/sandbox.json: { "restore": ["command", …] }. The commands
// are the team's, from the unchanged commit (as trusted as its build files); they replace the detected steps.
export class RepoRestoreOverride implements Restorer {
  plan(probe: RepoProbe): RestorePlan {
    const commands = commandsOf(probe.override);

    if (commands === null) {
      return { steps: [], skipped: probe.override === null ? [] : [".powerloom/sandbox.json has no \"restore\" list of commands: ignored"] };
    }

    return { steps: commands.map((command) => ({ label: command, ecosystem: "repo", argv: ["bash", "-lc", command], cwd: probe.folder })), skipped: [] };
  }

  /** The repo has a valid override: the detected steps don't run. */
  applies(probe: RepoProbe): boolean {
    return commandsOf(probe.override) !== null;
  }
}

function commandsOf(override: string | null): string[] | null {
  if (override === null) {
    return null;
  }

  try {
    const restore = (JSON.parse(override) as { restore?: unknown }).restore;

    return Array.isArray(restore) && restore.every((command) => typeof command === "string") ? restore as string[] : null;
  } catch {
    return null;
  }
}
