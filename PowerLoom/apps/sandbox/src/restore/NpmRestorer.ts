import type { RepoProbe } from "../models/RepoProbe";
import type { RestorePlan } from "../models/RestorePlan";
import type { Restorer } from "../models/Restorer";

// npm: only from a lock file, so the versions are the repo's; install scripts never run (--ignore-scripts): a
// package's script would run with the network. Without a lock file npm would pick fresh versions, so it is skipped.
export class NpmRestorer implements Restorer {
  plan(probe: RepoProbe): RestorePlan {
    if (!probe.files.includes("package.json") || probe.file) {
      return { steps: [], skipped: [] };
    }

    if (!probe.files.includes("package-lock.json")) {
      return { steps: [], skipped: ["package.json has no package-lock.json: npm packages were not restored (npm would pick new versions)"] };
    }

    return { steps: [{ label: "npm ci --ignore-scripts", ecosystem: "npm", argv: ["npm", "ci", "--ignore-scripts", "--no-audit", "--no-fund"], cwd: probe.folder }], skipped: [] };
  }
}
