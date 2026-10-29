import type { GuideImage } from "@powerloom/core";

// An image or GIF before it is stored: the writer adds its id, hash, size and inspection time.
export type NewGuideMedia = Omit<GuideImage, "id" | "sha256" | "bytes" | "inspectedAt" | "sourceOwner">;
