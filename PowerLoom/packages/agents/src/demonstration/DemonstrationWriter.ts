import { createHash } from "node:crypto";
import { defineTool } from "@agenttools/runtime";
import { guideAsset, localItem } from "@powerloom/db";
import { guideMediaTypeOf, guideReportSchema, readGuideRequest, type GuideImage, type GuideReport, type GuideRequest } from "@powerloom/core";
import { and, desc, eq, sql } from "drizzle-orm";
import type { ReadLog } from "../evidence/ReadLog";
import type { TaskContext } from "../models/TaskContext";
import type { RunWriter } from "../toolset/models/RunWriter";
import type { WriterTarget } from "../toolset/models/WriterTarget";
import type { WriterRunContext } from "../toolset/models/WriterRunContext";
import type { WriterSettlement } from "../toolset/models/WriterSettlement";
import { GuideCapture } from "./capture/GuideCapture";
import { gifTools } from "./gifTools";
import { imageTools } from "./imageTools";
import type { GuideCheckpoint } from "./models/GuideCheckpoint";
import type { GuideMediaHost } from "./models/GuideMediaHost";
import type { NewGuideMedia } from "./models/NewGuideMedia";
import { buildGuidePackage } from "./package";
import { guideProblems } from "./validation";
import { referencedImages } from "./referencedImages";

export const DEMONSTRATION_INTEGRATION = "writeDemonstrations";
const MAX_MEDIA = 20;
const MAX_PACKAGE_BYTES = 32 * 1024 * 1024;
const MAX_BYTES = { "image/png": 4 * 1024 * 1024, "image/gif": 8 * 1024 * 1024 };
type Task = typeof localItem.$inferSelect;

export class DemonstrationWriter implements RunWriter, GuideMediaHost {
  readonly integration = DEMONSTRATION_INTEGRATION;
  readonly capture = new GuideCapture();
  private task: Task | null = null;
  private request: GuideRequest | null = null;
  private runId = 0;
  private checkpoint: GuideCheckpoint = { requestHash: "", images: [], report: null };
  private inputProblem: string | null = null;
  private log: ReadLog | null = null;

  constructor(private readonly context: TaskContext) {}

  commitDraft(): unknown {
    return this.checkpoint;
  }

  async contextBlocks(task: Task, run: WriterRunContext): Promise<string[]> {
    this.task = task;
    this.runId = run.runId;

    try {
      this.request = readGuideRequest(task.body ?? "");
    } catch (e) {
      this.inputProblem = String(e);

      return ["Demonstration input blocked: " + String(e)];
    }

    this.checkpoint = this.restoredCheckpoint(task);

    const [previous] = await this.context.deps.db.select({ id: localItem.id, data: localItem.data }).from(localItem)
      .where(and(eq(localItem.parentId, task.id), eq(localItem.kind, "demonstration-result"))).orderBy(desc(localItem.createdAt)).limit(1);

    return ["<demonstration-input>\n" + JSON.stringify(this.request) + "\n</demonstration-input>",
      "<guide-checkpoint>\n" + JSON.stringify(this.checkpoint) + "\n</guide-checkpoint>",
      previous ? "<previous-package>\n" + JSON.stringify(previous) + "\n</previous-package>" : "No previous package."];
  }

  tools(log: ReadLog) {
    this.log = log;

    return [...imageTools(this, log), ...gifTools(this), this.writeGuideTool(log)];
  }

  mediaProblem(): string | null {
    if (!this.task || !this.request) {
      return "Resolve guide input first.";
    }

    if (!this.context.deps.devHub || !this.context.agent.capabilities.integrations?.localStack) {
      return "DevHub access is required.";
    }

    return null;
  }

  async saveMedia(media: NewGuideMedia, content: Buffer): Promise<GuideImage | { problem: string }> {
    const problem = this.sizeProblem(media, content);

    if (problem) {
      return { problem };
    }

    const task = this.task!;
    const sha256 = hash(content);
    const id = assetId(task.id + ":" + media.name + ":" + sha256);
    const mediaType = media.mediaType ?? guideMediaTypeOf(media.name);

    await this.context.deps.db.insert(guideAsset).values({ id, taskId: task.id, vault: task.vault, name: media.name, sha256, mediaType, content }).onConflictDoNothing();

    const image: GuideImage = { ...media, id, sha256, mediaType, bytes: content.length, sourceOwner: this.capture.runOwner ?? "powerloom-run-" + this.runId, inspectedAt: new Date().toISOString() };

    this.checkpoint.images = [...this.checkpoint.images.filter((i) => i.name !== media.name), image];
    await this.invalidateReport("Media changed; revalidate and write the guide again.");

    return image;
  }

  async approveMedia(name: string, sha256: string): Promise<GuideImage | { problem: string }> {
    const image = this.checkpoint.images.find((i) => i.name === name);

    if (!image || image.sha256 !== sha256) {
      return { problem: `No saved ${name} with sha256 ${sha256}; approve the exact derivative you viewed.` };
    }

    const approved = { ...image, approved: true, inspectedAt: new Date().toISOString() };

    this.checkpoint.images = this.checkpoint.images.map((i) => i.name === name ? approved : i);
    await this.invalidateReport("Media approved; write the guide again.");

    return approved;
  }

  async commit(target: WriterTarget): Promise<string[]> {
    if (!this.request || !this.checkpoint.report) {
      return [];
    }

    const report = this.committedReport(target.stoppedEarly);
    const images = referencedImages(report, this.checkpoint.images);
    const contents = await this.assetContents(target, images);
    const id = "SG-" + target.runId;
    const pkg = buildGuidePackage({ packageId: id, taskId: target.task.id, runId: target.runId, pbiId: target.task.pbiId, vault: target.task.vault, request: this.request, guide: report, images, contents, commits: target.repos.commits });

    await target.deps.db.insert(localItem).values({
      id, kind: "demonstration-result", pbiId: target.task.pbiId, vault: target.task.vault, parentId: target.task.id,
      title: report.title, status: "final", assignee: "agent:" + target.agentId,
      body: report.markdown, data: { guidePackage: pkg }, createdByRun: target.runId,
    }).onConflictDoNothing();

    return [id];
  }

  settlement(): WriterSettlement | null {
    if (this.inputProblem) {
      return { kind: "missing", output: this.inputProblem };
    }

    return this.checkpoint.report?.status === "ready" ? null : { kind: "missing", output: "a ready demonstration guide (write_demonstration)" };
  }

  private writeGuideTool(log: ReadLog) {
    return defineTool({
      name: "write_demonstration",
      description: "Save a structured demonstration guide checkpoint. Ready requires observed workflows, approved media for this build and no unresolved behavior. Checkpoints survive timeouts; publication is a separate handoff.",
      input: guideReportSchema.shape,
      handler: async (input) => {
        if (!this.request) {
          return error(this.inputProblem ?? "Guide input missing.");
        }

        const problems = guideProblems(input, this.request, referencedImages(input, this.checkpoint.images), log, this.capture.runOwner ?? "powerloom-run-" + this.runId);

        if (problems.length) {
          return error(problems.join("; "));
        }

        this.checkpoint.report = { ...input, verifiedAt: new Date().toISOString() };
        await this.saveCheckpoint();

        return { text: "Guide checkpoint saved: " + input.status + ". Publication has not happened." };
      },
    });
  }

  private restoredCheckpoint(task: Task): GuideCheckpoint {
    const requestHash = hash(JSON.stringify({ request: this.request, body: task.body, goal: (task.data as { goal?: string } | null)?.goal }));
    const saved = (task.data as { guideCheckpoint?: GuideCheckpoint } | null)?.guideCheckpoint;

    if (saved?.requestHash !== requestHash) {
      return { requestHash, images: [], report: null };
    }

    if (!saved.report) {
      return saved;
    }

    return { ...saved, report: { ...saved.report, status: "partial", blockers: [...saved.report.blockers, "Revalidate the runtime and recapture media in this run before ready."] } };
  }

  // A ready report that no longer passes is committed as partial, with the reasons, instead of failing the run.
  private committedReport(stoppedEarly: boolean): GuideReport {
    const report = this.checkpoint.report!;

    if (stoppedEarly) {
      return { ...report, status: "partial" };
    }

    if (report.status !== "ready") {
      return report;
    }

    const problems = this.log ? guideProblems(report, this.request!, referencedImages(report, this.checkpoint.images), this.log, this.capture.runOwner ?? "powerloom-run-" + this.runId) : ["Read evidence is unavailable"];

    return problems.length ? { ...report, status: "partial", blockers: [...report.blockers, ...problems] } : report;
  }

  private async assetContents(target: WriterTarget, images: GuideImage[]): Promise<Map<string, Buffer>> {
    const contents = new Map<string, Buffer>();

    for (const image of images) {
      const [asset] = await target.deps.db.select().from(guideAsset).where(and(eq(guideAsset.id, image.id), eq(guideAsset.taskId, target.task.id), eq(guideAsset.vault, target.task.vault)));

      if (!asset || hash(asset.content) !== image.sha256)
        throw new Error("Missing or changed guide asset: " + image.name);

      contents.set(image.id, asset.content);
    }

    return contents;
  }

  private sizeProblem(media: NewGuideMedia, content: Buffer): string | null {
    const mediaType = media.mediaType ?? guideMediaTypeOf(media.name);
    const kept = this.checkpoint.images.filter((i) => i.name !== media.name);

    if (kept.length >= MAX_MEDIA) {
      return `At most ${MAX_MEDIA} publication images and GIFs.`;
    }

    if (content.length > MAX_BYTES[mediaType]) {
      return `${media.name} is ${content.length} bytes; the limit for ${mediaType} is ${MAX_BYTES[mediaType]}. Crop, lower maxWidth or record fewer steps.`;
    }

    if (kept.reduce((n, i) => n + i.bytes, 0) + content.length > MAX_PACKAGE_BYTES) {
      return "Package media would exceed 32 MB; crop or recapture smaller images.";
    }

    return null;
  }

  private async invalidateReport(blocker: string): Promise<void> {
    if (this.checkpoint.report) {
      this.checkpoint.report = { ...this.checkpoint.report, status: "partial", blockers: [...this.checkpoint.report.blockers, blocker] };
    }

    await this.saveCheckpoint();
  }

  private async saveCheckpoint(): Promise<void> {
    const data = sql(["jsonb_set(coalesce(", ", '{}'::jsonb), '{guideCheckpoint}', ", "::jsonb)"] as unknown as TemplateStringsArray, localItem.data, JSON.stringify(this.checkpoint));

    await this.context.deps.db.update(localItem).set({ data }).where(eq(localItem.id, this.task!.id));
  }
}

function assetId(seed: string): string {
  const key = hash(seed).slice(0, 32);

  return key.slice(0, 8) + "-" + key.slice(8, 12) + "-" + key.slice(12, 16) + "-" + key.slice(16, 20) + "-" + key.slice(20);
}

const hash = (v: string | Buffer) => createHash("sha256").update(v).digest("hex");
const error = (text: string) => ({ text, isError: true });
