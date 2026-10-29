import { z } from "zod";

export const DEMONSTRATION_LABEL = "Demonstration";
const url = z.string().url().refine(value => {
  const u = new URL(value);
  return ["http:", "https:"].includes(u.protocol) && !u.username && !u.password && !u.hash && !u.search;
}, "Use an http(s) URL without credentials, query parameters or fragments");
export const guideRequestSchema = z.object({
  mode: z.enum(["local-stack", "remote-url"]), url, allowedOrigins: z.array(url).min(1).max(12),
  branch: z.string().default(""), services: z.array(z.string().min(1)).default([]),
  audience: z.string().min(1), environment: z.string().min(1), permittedActions: z.string().min(1),
  data: z.string().min(1), owner: z.string().min(1), release: z.string().default(""),
  // CSS selectors masked solid in every screenshot before the agent sees it; password inputs always are.
  maskSelectors: z.array(z.string().min(1).max(200)).max(20).default([]),
  destination: z.discriminatedUnion("action", [
    z.object({ action: z.literal("unspecified") }),
    z.object({ action: z.literal("create"), site: url, space: z.string().min(1), title: z.string().min(1), parentId: z.string().regex(/^\d+$/) }),
    z.object({ action: z.literal("update"), site: url, space: z.string().min(1), title: z.string().min(1), pageId: z.string().regex(/^\d+$/), version: z.number().int().positive(), sections: z.string().min(1) }),
  ]).default({ action: "unspecified" }),
}).superRefine((r, ctx) => {
  if (r.mode === "local-stack" && (!r.branch.trim() || !r.services.length)) ctx.addIssue({ code: "custom", message: "Local mode needs the branch and service names" });
  if (!r.allowedOrigins.some(v => new URL(v).origin === new URL(r.url).origin)) ctx.addIssue({ code: "custom", message: "Include the entry URL's origin" });
  if (r.allowedOrigins.some(v => new URL(v).pathname !== "/")) ctx.addIssue({ code: "custom", message: "allowedOrigins must not contain paths" });
});
export type GuideRequest = z.infer<typeof guideRequestSchema>;
export function readGuideRequest(body: string): GuideRequest {
  const match = /\x60{3}demonstration\s*\n([\s\S]*?)\n\x60{3}/.exec(body);
  if (!match) throw new Error("Add a demonstration input block (Tasks → New → demonstration).");
  return guideRequestSchema.parse(JSON.parse(match[1]));
}
export function guideRequestBlock(request: GuideRequest): string {
  return "\n\n\x60\x60\x60demonstration\n" + JSON.stringify(request, null, 2) + "\n\x60\x60\x60";
}
export function guideUrlAllowed(value: string, origins: string[]): boolean {
  try { const u = new URL(value); return ["https:", "http:"].includes(u.protocol) && !u.username && !u.password && origins.some(o => new URL(o).origin === u.origin); } catch { return false; }
}
