import { createHash } from "node:crypto";
import type { ToolDefinition, ToolResult } from "@agenttools/runtime";
import type { DevHubClient } from "@powerloom/devhub";
import type { CaptureRecord } from "../models/CaptureRecord";
import type { CapturedFrame } from "../models/CapturedFrame";
import type { GifRecording } from "../models/GifRecording";
import type { Raster } from "../media/models/Raster";
import { encodePng, tryDecodePng } from "../media/raster";
import { applyRegion } from "../media/regions";
import { ALWAYS_MASKED, POINTER_SCRIPT, evaluatedObject, maskBoxes, maskBoxesScript } from "./pageScripts";
import { describeStep, isClick, RECORDED_ACTIONS } from "./steps";

const MAX_GIF_STEPS = 12;
const SIMPLE_FILE = /^[A-Za-z0-9][A-Za-z0-9_-]*\.png$/;
const SEGMENT_NAME = /^[a-z0-9][a-z0-9-]{0,40}$/;

type Captured = { record: CaptureRecord; raster: Raster; page: string | null } | { problem: string };

// The run's screenshot boundary (Demonstration): every screenshot is masked before the agent sees it, the raw file
// stays on the DevHub host, and what was masked is remembered for the derivatives. Also records GIF segments.
export class GuideCapture {
  private owner: string | null = null;
  private client: DevHubClient | null = null;
  private selectors: string[] = ALWAYS_MASKED;
  private openCase: string | null = null;
  private screenshotTool: ToolDefinition<any> | null = null;
  private evaluateTool: ToolDefinition<any> | null = null;
  private readonly records = new Map<string, CaptureRecord>();
  private recording: GifRecording | null = null;
  private shotNumber = 0;

  bind(owner: string, client: DevHubClient | null, maskSelectors: string[]): void {
    this.owner = owner;
    this.client = client;
    this.selectors = [...ALWAYS_MASKED, ...maskSelectors];
  }

  get runOwner(): string | null {
    return this.owner;
  }

  /** The browser tools with screenshots masked, the open case tracked and GIF steps captured before each action. */
  wrap(tools: ToolDefinition<any>[]): ToolDefinition<any>[] {
    this.screenshotTool = tools.find((tool) => tool.name === "browser_take_screenshot") ?? null;
    this.evaluateTool = tools.find((tool) => tool.name === "browser_evaluate") ?? null;

    return tools.map((tool) => ({ ...tool, handler: this.handlerFor(tool) }));
  }

  record(caseName: string, file: string): CaptureRecord | null {
    return this.records.get(caseName + "/" + file) ?? null;
  }

  /** The screenshot again, masked exactly as the agent saw it; refused when the file changed since it was taken. */
  async readMasked(caseName: string, file: string): Promise<{ record: CaptureRecord; raster: Raster } | { problem: string }> {
    const record = this.record(caseName, file);

    if (!record || !this.owner || !this.client) {
      return { problem: "Only screenshots this run took with browser_take_screenshot can be imported." };
    }

    const answer = await this.client.browserImage(this.owner, caseName, file);

    if (!answer.ok) {
      return { problem: answer.message };
    }

    const bytes = Buffer.from(answer.value.base64, "base64");

    const raster = sha256(bytes) === record.rawSha256 ? tryDecodePng(bytes) : null;

    if (!raster) {
      return { problem: `${file} changed since it was captured; take the screenshot again.` };
    }

    record.masks.forEach((box) => applyRegion(raster, { ...box, style: "solid" }));

    return { record, raster };
  }

  startGif(name: string): string | null {
    if (!SEGMENT_NAME.test(name)) {
      return "Name the segment in lowercase letters, digits and dashes.";
    }

    if (!this.openCase) {
      return "Open a browser case before recording.";
    }

    if (this.recording && !this.recording.stopped) {
      return `Segment ${this.recording.name} is still recording; stop_guide_gif first.`;
    }

    this.recording = { name, caseName: this.openCase, frames: [], stopped: false };

    return null;
  }

  async stopGif(name: string): Promise<GifRecording | { problem: string }> {
    const recording = this.recording;

    if (!recording || recording.name !== name || recording.stopped) {
      return { problem: `No segment ${name} is recording.` };
    }

    const last = recording.frames.at(-1)?.step.pointer ?? null;
    const captured = await this.capture(frameFile(recording), false);

    if ("problem" in captured) {
      return captured;
    }

    recording.frames.push(frameOf(captured, { index: recording.frames.length, tool: "final", label: "Result", value: null, pointer: last, pointerInterpolated: false, url: captured.page, click: false }));
    recording.stopped = true;

    return recording;
  }

  /** The stopped segment add_guide_gif turns into a GIF. */
  stoppedGif(name: string): GifRecording | null {
    return this.recording?.name === name && this.recording.stopped ? this.recording : null;
  }

  private handlerFor(tool: ToolDefinition<any>): (input: any) => Promise<ToolResult> {
    if (tool.name === "browser_take_screenshot") {
      return (input) => this.screenshot(input);
    }

    if (tool.name === "browser_open" || tool.name === "browser_close") {
      return (input) => this.trackCase(tool, input);
    }

    if (RECORDED_ACTIONS.has(tool.name)) {
      return (input) => this.recordThenRun(tool, input);
    }

    return tool.handler;
  }

  private async screenshot(input: Record<string, unknown>): Promise<ToolResult> {
    if (input.target || input.element) {
      return failure("Capture the viewport or the full page; crop it later in add_guide_image.");
    }

    if (input.filename !== undefined && !SIMPLE_FILE.test(String(input.filename))) {
      return failure("Use a simple .png filename such as 03-rule-form.png.");
    }

    const file = input.filename ? String(input.filename) : `shot-${++this.shotNumber}.png`;
    const captured = await this.capture(file, input.fullPage === true);

    if ("problem" in captured) {
      return failure(captured.problem);
    }

    const masked = captured.record.masks.length;

    return {
      text: `Screenshot saved as ${file} in case ${captured.record.caseName} (${captured.raster.width}×${captured.raster.height} CSS px); ${masked} region(s) masked solid before you saw it. Import it with add_guide_image.`,
      images: [{ data: encodePng(captured.raster).toString("base64"), mimeType: "image/png" }],
    };
  }

  private async trackCase(tool: ToolDefinition<any>, input: Record<string, unknown>): Promise<ToolResult> {
    const result = await tool.handler(input);

    if (result.isError) {
      return result;
    }

    this.openCase = tool.name === "browser_open" ? String(input.case) : null;

    if (tool.name === "browser_close" && this.recording && !this.recording.stopped) {
      const dropped = this.recording.name;

      this.recording = null;

      return { ...result, text: `${result.text}\nGIF segment ${dropped} was still recording and is discarded.` };
    }

    return result;
  }

  private async recordThenRun(tool: ToolDefinition<any>, input: Record<string, unknown>): Promise<ToolResult> {
    const recording = this.recording;

    if (!recording || recording.stopped || recording.caseName !== this.openCase) {
      return tool.handler(input);
    }

    if (recording.frames.length >= MAX_GIF_STEPS) {
      return failure(`A GIF segment holds at most ${MAX_GIF_STEPS} steps; stop_guide_gif first. The action was not run.`);
    }

    const pointer = await this.pointerOf(input);
    const captured = await this.capture(frameFile(recording), false);

    if ("problem" in captured) {
      return failure(`GIF frame capture failed (${captured.problem}); the action was not run.`);
    }

    recording.frames.push(frameOf(captured, { index: recording.frames.length, ...describeStep(tool.name, input), pointer, pointerInterpolated: false, url: captured.page, click: isClick(tool.name) }));

    return tool.handler(input);
  }

  private async pointerOf(input: Record<string, unknown>): Promise<{ x: number; y: number } | null> {
    if (typeof input.x === "number" && typeof input.y === "number") {
      return { x: input.x, y: input.y };
    }

    const target = typeof input.target === "string" ? input.target : firstFieldTarget(input);

    if (!target || !this.evaluateTool) {
      return null;
    }

    const result = await this.evaluateTool.handler({ function: POINTER_SCRIPT, target, element: String(input.element ?? "recorded target") });
    const point = result.isError ? null : evaluatedObject(result.text);

    return point && typeof point.x === "number" && typeof point.y === "number" ? { x: point.x, y: point.y } : null;
  }

  // Fails closed: without the mask boxes or the file's bytes, nothing is shown or recorded.
  private async capture(file: string, fullPage: boolean): Promise<Captured> {
    if (!this.owner || !this.client || !this.screenshotTool || !this.evaluateTool) {
      return { problem: "DevHub screenshots and browser_evaluate are required." };
    }

    if (!this.openCase) {
      return { problem: "Open a browser case first." };
    }

    const boxes = await this.evaluateTool.handler({ function: maskBoxesScript(this.selectors) });
    const located = boxes.isError ? null : evaluatedObject(boxes.text);

    if (!located || typeof located.error === "string") {
      return { problem: `Could not locate the masked fields${located?.error ? ": " + located.error : ""}; screenshot refused.` };
    }

    const shot = await this.screenshotTool.handler({ type: "png", scale: "css", filename: file, ...(fullPage ? { fullPage: true } : {}) });

    if (shot.isError) {
      return { problem: shot.text };
    }

    return this.maskedFile(file, fullPage, located);
  }

  private async maskedFile(file: string, fullPage: boolean, located: Record<string, unknown>): Promise<Captured> {
    const caseName = this.openCase!;
    const answer = await this.client!.browserImage(this.owner!, caseName, file);

    if (!answer.ok) {
      return { problem: answer.message };
    }

    const bytes = Buffer.from(answer.value.base64, "base64");

    const raster = tryDecodePng(bytes);

    if (!raster) {
      return { problem: "The screenshot is not a readable PNG." };
    }
    const masks = maskBoxes(located, fullPage, raster.width, raster.height);

    masks.forEach((box) => applyRegion(raster, { ...box, style: "solid" }));

    const record = { caseName, file, rawSha256: sha256(bytes), width: raster.width, height: raster.height, masks };

    this.records.set(caseName + "/" + file, record);

    return { record, raster, page: typeof located.page === "string" ? located.page : null };
  }
}

function frameOf(captured: { record: CaptureRecord; raster: Raster }, step: CapturedFrame["step"]): CapturedFrame {
  return { raster: captured.raster, rawSha256: captured.record.rawSha256, masks: captured.record.masks.length, step };
}

function frameFile(recording: GifRecording): string {
  return `gif-${recording.name}-${String(recording.frames.length).padStart(2, "0")}.png`;
}

function firstFieldTarget(input: Record<string, unknown>): string | null {
  const fields = Array.isArray(input.fields) ? input.fields as { target?: unknown; ref?: unknown }[] : [];
  const first = fields[0]?.target ?? fields[0]?.ref;

  return typeof first === "string" ? first : null;
}

const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const failure = (text: string): ToolResult => ({ text, isError: true });
