import { PACKAGES } from "@powerloom/sandbox";
import type { ContainerExec } from "../docker/ContainerExec";
import type { CacheCount } from "../models/CacheCount";

// NuGet keeps a package version as <id>/<version>/ under its folder; `du -sk` because busybox's du has no -b.
const MEASURE_SCRIPT = `find "$1/nuget" -mindepth 2 -maxdepth 2 -type d 2>/dev/null | wc -l; du -sk "$1" 2>/dev/null | cut -f1`;
const MEASURE_DEADLINE_MS = 15_000;

/** The package cache as the restore container sees it; null when it couldn't be measured (the container is gone). */
export async function packageCacheSize(exec: ContainerExec): Promise<CacheCount | null> {
  try {
    const measured = await exec.run(["sh", "-c", MEASURE_SCRIPT, "sh", PACKAGES], { deadlineMs: MEASURE_DEADLINE_MS });

    return cacheCountOf(measured.stdout.toString("utf8"));
  } catch {
    return null;
  }
}

export function cacheCountOf(output: string): CacheCount | null {
  const [packages, kilobytes] = output.trim().split(/\s+/).map(Number);

  if (!Number.isFinite(packages) || !Number.isFinite(kilobytes)) {
    return null;
  }

  return { nugetPackages: packages, bytes: kilobytes * 1024 };
}
