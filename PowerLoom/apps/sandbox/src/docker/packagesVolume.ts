import { createHash } from "node:crypto";
import type { PackagesVolume } from "../models/PackagesVolume";

// Docker volume names allow letters, digits and `_.-`; the hash keeps two keys that slug alike apart.
const NOT_IN_NAME = /[^a-z0-9_.-]+/g;
const SLUG_CHARS = 40;
const HASH_CHARS = 10;

// The label of a shared cache: the service's start and a sandbox's removal look for the sandbox label only, so a cache
// outlives every sandbox that used it.
export const PACKAGE_CACHE_LABEL = "powerloom.package-cache";

/** The vault's cache for a `cacheKey`, else a volume of the sandbox's own. */
export function packagesVolumeOf(id: string, cacheKey: string | undefined): PackagesVolume {
  if (!cacheKey) {
    return { name: `powerloom-sandbox-${id}-packages`, shared: false };
  }

  const slug = cacheKey.toLowerCase().replace(NOT_IN_NAME, "-").slice(0, SLUG_CHARS);
  const hash = createHash("sha256").update(cacheKey).digest("hex").slice(0, HASH_CHARS);

  return { name: `powerloom-packages-${slug}-${hash}`, shared: true };
}
