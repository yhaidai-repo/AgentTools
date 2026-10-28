import { readFileSync } from "node:fs";
import type { SandboxImage } from "./models/SandboxImage";

// The general image when there is no catalog file: what Dockerfile.sandbox builds.
export const GENERAL_IMAGE: SandboxImage = { name: "general", image: "powerloom-sandbox", description: "the general toolchains (Dockerfile.sandbox)" };

/** The images a vault may pick (design agent-sandbox, phase 3b); the first is the default. Without a file, the general one. */
export function readImageCatalog(path: string | undefined): SandboxImage[] {
  if (!path) {
    return [GENERAL_IMAGE];
  }

  const images = (JSON.parse(readFileSync(path, "utf8")) as { images?: SandboxImage[] }).images ?? [];
  const valid = images.filter((entry) => typeof entry.name === "string" && typeof entry.image === "string" && entry.name.length > 0 && entry.image.length > 0);

  return valid.length > 0 ? valid.map((entry) => ({ ...entry, description: entry.description ?? "" })) : [GENERAL_IMAGE];
}

/** The catalog entry a vault picked: the first one for an empty name, null for a name the catalog doesn't have. */
export function imageNamed(catalog: SandboxImage[], name: string): SandboxImage | null {
  return name.length === 0 ? catalog[0] : catalog.find((entry) => entry.name === name) ?? null;
}
