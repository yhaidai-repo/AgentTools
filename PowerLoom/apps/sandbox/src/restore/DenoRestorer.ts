import type { RepoProbe } from "../models/RepoProbe";
import type { RestorePlan } from "../models/RestorePlan";
import type { Restorer } from "../models/Restorer";

const CONFIG_FILES = ["deno.json", "deno.jsonc"];

// Deno: the imports deno.json declares, into the cache (DENO_DIR); deno.lock keeps their versions when there is one.
export class DenoRestorer implements Restorer {
  plan(probe: RepoProbe): RestorePlan {
    const hasConfig = CONFIG_FILES.some((file) => probe.files.includes(file));

    if (!hasConfig || probe.file) {
      return { steps: [], skipped: [] };
    }

    return { steps: [{ label: "deno install", ecosystem: "deno", argv: ["deno", "install"], cwd: probe.folder }], skipped: [] };
  }
}
