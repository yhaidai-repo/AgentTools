import { createHash } from "node:crypto";
import { defineTool } from "@agenttools/runtime";
import { guideAsset, localItem } from "@powerloom/db";
import { guideImageReferences, guideReportSchema, readGuideRequest, type GuideImage, type GuideReport, type GuideRequest } from "@powerloom/core";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { ReadLog } from "../evidence/ReadLog";
import type { TaskContext } from "../models/TaskContext";
import type { RunWriter } from "../toolset/models/RunWriter";
import type { WriterTarget } from "../toolset/models/WriterTarget";
import type { WriterRunContext } from "../toolset/models/WriterRunContext";
import type { WriterSettlement } from "../toolset/models/WriterSettlement";
import { buildGuidePackage } from "./package";
import { guideProblems } from "./validation";

export const SUPPORT_GUIDE_INTEGRATION = "writeSupportGuides";
type Task = typeof localItem.$inferSelect;
interface Checkpoint { requestHash: string; images: GuideImage[]; report: GuideReport | null }

export class SupportGuideWriter implements RunWriter {
  readonly integration = SUPPORT_GUIDE_INTEGRATION;
  private task: Task | null = null;
  private request: GuideRequest | null = null;
  private runId = 0;
  private checkpoint: Checkpoint = { requestHash: "", images: [], report: null };
  private inputProblem: string | null = null;
  private log: ReadLog | null = null;
  constructor(private readonly context: TaskContext) {}
  commitDraft(): unknown { return this.checkpoint; }

  async contextBlocks(task: Task, run: WriterRunContext): Promise<string[]> {
    this.task = task; this.runId = run.runId;
    try { this.request = readGuideRequest(task.body ?? ""); } catch (e) { this.inputProblem = String(e); return ["Support guide input blocked: " + String(e)]; }
    const requestHash = hash(JSON.stringify({ request: this.request, body: task.body, goal: (task.data as { goal?: string } | null)?.goal }));
    const data = (task.data ?? {}) as { guideCheckpoint?: Checkpoint };
    this.checkpoint = data.guideCheckpoint?.requestHash === requestHash ? data.guideCheckpoint : { requestHash, images: [], report: null };
    if (this.checkpoint.report) this.checkpoint.report = { ...this.checkpoint.report, status: "partial", blockers: [...this.checkpoint.report.blockers, "Revalidate the runtime and recapture screenshots in this run before ready."] };
    const [previous] = await this.context.deps.db.select({ id: localItem.id, data: localItem.data }).from(localItem)
      .where(and(eq(localItem.parentId, task.id), eq(localItem.kind, "support-guide-result"))).orderBy(desc(localItem.createdAt)).limit(1);
    return ["<support-guide-input>\n" + JSON.stringify(this.request) + "\n</support-guide-input>",
      "<guide-checkpoint>\n" + JSON.stringify(this.checkpoint) + "\n</guide-checkpoint>",
      previous ? "<previous-package>\n" + JSON.stringify(previous) + "\n</previous-package>" : "No previous package."];
  }

  tools(log: ReadLog) {
    this.log = log;
    return [
      defineTool({
        name: "add_guide_image",
        description: "Import a PNG from this run's DevHub case AFTER viewing it and checking for secrets/private data. The approved image survives recording cleanup. Save browser_take_screenshot with a simple filename in its case output directory. Use clean demonstration data; arbitrary host paths are refused.",
        input: {
          case: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/), file: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]*\.png$/),
          name: z.string().regex(/^[a-z0-9][a-z0-9-]*\.png$/), caption: z.string().min(1), alt: z.string().min(1),
          source: z.string().regex(/^S\d+$/), buildIdentity: z.string().min(1), inspected: z.literal(true), sanitized: z.literal(true),
        },
        handler: async input => {
          if (!this.task || !this.request) return error("Resolve guide input first.");
          const hub = this.context.deps.devHub;
          if (!hub || !this.context.agent.capabilities.integrations?.localStack) return error("DevHub access is required.");
          if (log.find(input.source)?.tool !== "browser_take_screenshot" || !log.find(input.source)?.fresh || !(log.find(input.source)?.resultText ?? "").includes(input.file)) return error("Cite the screenshot result naming this file.");
          if (this.checkpoint.images.length >= 20 && !this.checkpoint.images.some(i => i.name === input.name)) return error("At most 20 publication images.");
          const owner = "powerloom-run-" + this.runId;
          const answer = await hub.client.browserImage(owner, input.case, input.file);
          if (!answer.ok) return error(answer.message);
          const content = Buffer.from(answer.value.base64, "base64");
          if (content.length < 24 || !content.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || content.length > 2 * 1024 * 1024) return error("Invalid PNG or image exceeds 2 MB.");
          const width = content.readUInt32BE(16), height = content.readUInt32BE(20);
          if (!width || !height || width > 16000 || height > 16000) return error("Invalid screenshot dimensions.");
          const kept = this.checkpoint.images.filter(i => i.name !== input.name);
          if (kept.reduce((n, i) => n + i.bytes, 0) + content.length > 16 * 1024 * 1024) return error("Package images exceed 16 MB; crop or recapture smaller images.");
          const sha256 = hash(content), key = hash(this.task.id + ":" + input.name + ":" + sha256).slice(0, 32);
          const id = key.slice(0, 8) + "-" + key.slice(8, 12) + "-" + key.slice(12, 16) + "-" + key.slice(16, 20) + "-" + key.slice(20);
          await this.context.deps.db.insert(guideAsset).values({ id, taskId: this.task.id, vault: this.task.vault, name: input.name, sha256, content }).onConflictDoNothing();
          const image: GuideImage = { id, name: input.name, sha256, width, height, bytes: content.length, caption: input.caption, alt: input.alt, source: input.source, sourceOwner: owner, sourceCase: input.case, inspectedAt: new Date().toISOString(), buildIdentity: input.buildIdentity };
          this.checkpoint.images = [...kept, image];
          if (this.checkpoint.report) this.checkpoint.report = { ...this.checkpoint.report, status: "partial", blockers: [...this.checkpoint.report.blockers, "Images changed; revalidate and write the guide again."] };
          await this.saveCheckpoint();
          return { text: "Approved image saved: images/" + image.name + " (" + width + "×" + height + ", sha256 " + sha256 + ")." };
        },
      }),
      defineTool({
        name: "write_support_guide",
        description: "Save a structured support guide checkpoint. Ready requires observed workflows, inspected images for this build and no unresolved behavior. Checkpoints survive timeouts; publication is a separate handoff.",
        input: guideReportSchema.shape,
        handler: async input => {
          if (!this.request) return error(this.inputProblem ?? "Guide input missing.");
          const names = new Set(guideImageReferences(input.markdown).urls.map(url => url.slice(7)));
          const activeImages = this.checkpoint.images.filter(image => names.has(image.name));
          const problems = guideProblems(input, this.request, activeImages, log, "powerloom-run-" + this.runId);
          if (problems.length) return error(problems.join("; "));
          this.checkpoint.report = { ...input, verifiedAt: new Date().toISOString() };
          await this.saveCheckpoint();
          return { text: "Guide checkpoint saved: " + input.status + ". Publication has not happened." };
        },
      }),
    ];
  }

  private async saveCheckpoint(): Promise<void> {
    const data = sql(["jsonb_set(coalesce(", ", '{}'::jsonb), '{guideCheckpoint}', ", "::jsonb)"] as unknown as TemplateStringsArray, localItem.data, JSON.stringify(this.checkpoint));
    await this.context.deps.db.update(localItem).set({ data }).where(eq(localItem.id, this.task!.id));
  }

  async commit(target: WriterTarget): Promise<string[]> {
    if (!this.request || !this.checkpoint.report) return [];
    const report = target.stoppedEarly ? { ...this.checkpoint.report, status: "partial" as const } : this.checkpoint.report;
    const referenced = new Set(guideImageReferences(report.markdown).urls.map(url => url.slice(7)));
    const images = this.checkpoint.images.filter(i => referenced.has(i.name)), contents = new Map<string, Buffer>();
    if (report.status === "ready") {
      const problems = this.log ? guideProblems(report, this.request, images, this.log, "powerloom-run-" + this.runId) : ["Read evidence is unavailable"];
      if (problems.length) throw new Error("Guide is no longer ready: " + problems.join("; "));
    }
    for (const image of images) {
      const [asset] = await target.deps.db.select().from(guideAsset).where(and(eq(guideAsset.id, image.id), eq(guideAsset.taskId, target.task.id), eq(guideAsset.vault, target.task.vault)));
      if (!asset || hash(asset.content) !== image.sha256) throw new Error("Missing or changed guide asset: " + image.name);
      contents.set(image.id, asset.content);
    }
    const id = "SG-" + target.runId;
    const pkg = buildGuidePackage({ packageId: id, taskId: target.task.id, runId: target.runId, pbiId: target.task.pbiId, vault: target.task.vault, request: this.request, guide: report, images, contents, commits: target.repos.commits });
    await target.deps.db.insert(localItem).values({
      id, kind: "support-guide-result", pbiId: target.task.pbiId, vault: target.task.vault, parentId: target.task.id,
      title: report.title, status: "final", assignee: "agent:" + target.agentId,
      body: report.markdown, data: { guidePackage: pkg }, createdByRun: target.runId,
    }).onConflictDoNothing();
    return [id];
  }

  settlement(): WriterSettlement | null {
    if (this.inputProblem) return { kind: "missing", output: this.inputProblem };
    return this.checkpoint.report?.status === "ready" ? null : { kind: "missing", output: "a ready support guide (write_support_guide)" };
  }
}
const hash = (v: string | Buffer) => createHash("sha256").update(v).digest("hex");
const error = (text: string) => ({ text, isError: true });
