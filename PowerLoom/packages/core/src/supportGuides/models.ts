import { z } from "zod";
export const guideReportSchema = z.object({
  title: z.string().min(1).max(120), status: z.enum(["partial", "blocked", "ready"]), summary: z.string().min(1),
  markdown: z.string().max(120_000), buildIdentity: z.string().min(1).describe("Resolved commits or verified remote deployment identity; 'unknown' if unavailable"),
  buildSource: z.string().regex(/^S\d+$/).describe("Current DevHub status source or browser deployment identity source; any source when unknown"),
  identityBasis: z.enum(["observed", "stated"]).default("observed").describe("stated: a remote app shows no build or release, so buildIdentity is the task's input build and the release is the task's own; the package says they were stated, not observed"),
  releaseVerified: z.boolean(),
  releaseSource: z.string().regex(/^S\d+$/).optional().describe("Fresh browser source showing the applicable release; required when the task names a release"),
  verifiedAt: z.string().datetime(),
  configuration: z.string().min(1).describe("Non-secret flags, role, language and viewport"),
  workflows: z.array(z.object({
    id: z.string().min(1), title: z.string().min(1), state: z.enum(["observed", "blocked", "not-run"]),
    steps: z.array(z.string().min(1)).min(1), expected: z.string().min(1), observed: z.string(),
    source: z.string().regex(/^S\d+$/).describe("Source id of actual browser observation, not code"),
    images: z.array(z.string()).default([]),
  })).min(1),
  rules: z.array(z.object({ claim: z.string().min(1), certainty: z.enum(["observed", "code-supported", "unresolved"]), source: z.string().regex(/^S\d+$/) })).default([]),
  blockers: z.array(z.string()).default([]), verification: z.string().min(1).max(30_000),
});
export type GuideReport = z.infer<typeof guideReportSchema>;
export type GuideMediaType = "image/png" | "image/gif";
export interface GuideImage {
  id: string; name: string; sha256: string; width: number; height: number; bytes: number;
  caption: string; alt: string; source: string; sourceOwner: string; sourceCase: string; inspectedAt: string; buildIdentity: string;
  /** Missing on packages from before GIF support: PNG. */
  mediaType?: GuideMediaType;
  /** False until the agent has viewed this exact derivative (approve_guide_image); missing on older packages: approved. */
  approved?: boolean;
  /** How the stored bytes were derived from the captured screenshots; the originals stay on the DevHub host. */
  transform?: GuideTransform;
  /** GIF only: the recorded actions, one per step, with their frame timing. */
  timeline?: GuideTimelineStep[];
}
export interface GuideRegion { x: number; y: number; width: number; height: number; style: "solid" | "blur"; frames?: number[] }
export interface GuideTransform { sourceSha256: string[]; captureMasks: number; regions: GuideRegion[]; crop: { x: number; y: number; width: number; height: number } | null; scale: number }
export interface GuideTimelineStep { index: number; tool: string; label: string; value: string | null; pointer: { x: number; y: number } | null; pointerInterpolated: boolean; url: string | null; delayMs: number }
export interface GuidePackageData {
  schemaVersion: 1; packageId: string; taskId: string; runId: number; vault: string; pbiId: number | null;
  guide: GuideReport; images: GuideImage[]; files: { path: string; text: string }[]; contentChecksum: string;
  publicationStatus: "awaiting-details" | "pending" | "published" | "failed";
  publication?: { url: string; version: number; checkedAt: string };
}

// A publishable image name, as Markdown references it under images/ (user-chosen names; never a host path).
export const GUIDE_IMAGE_NAME = /^[a-z0-9][a-z0-9-]*\.(?:png|gif)$/;

export function guideMediaTypeOf(name: string): GuideMediaType {
  return name.endsWith(".gif") ? "image/gif" : "image/png";
}
