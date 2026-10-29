import { z } from "zod";
export const guideReportSchema = z.object({
  title: z.string().min(1).max(120), status: z.enum(["partial", "blocked", "ready"]), summary: z.string().min(1),
  markdown: z.string().max(120_000), buildIdentity: z.string().min(1).describe("Resolved commits or verified remote deployment identity; 'unknown' if unavailable"),
  buildSource: z.string().regex(/^S\d+$/).describe("Current DevHub status source or browser deployment identity source; any source when unknown"),
  releaseVerified: z.boolean(), verifiedAt: z.string().datetime(),
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
export interface GuideImage {
  id: string; name: string; sha256: string; width: number; height: number; bytes: number;
  caption: string; alt: string; source: string; sourceOwner: string; sourceCase: string; inspectedAt: string; buildIdentity: string;
}
export interface GuidePackageData {
  schemaVersion: 1; packageId: string; taskId: string; runId: number; vault: string; pbiId: number | null;
  guide: GuideReport; images: GuideImage[]; files: { path: string; text: string }[]; contentChecksum: string;
  publicationStatus: "awaiting-details" | "pending" | "published" | "failed";
  publication?: { url: string; version: number; checkedAt: string };
}
