import type { GuideRegion, GuideTimelineStep } from "@powerloom/core";
import type { CapturedFrame } from "../models/CapturedFrame";
import type { PixelBox } from "./models/PixelBox";
import type { Raster } from "./models/Raster";
import { drawClickPulse, drawPointer } from "./overlay";
import { copyRaster, cropRaster, scaleDown } from "./raster";
import { applyRegion, regionProblem } from "./regions";
import { zoomFrame, zoomProblem, type GifZoom } from "./zoom";
import { cameraViews, CAMERA_FRAME_MS } from "./camera";

const STEP_DELAY_MS = 1200;
const FINAL_DELAY_MS = 2500;
const MOVE_DELAY_MS = 150;
const CLICK_FRAME_MS = 60;
const CLICK_PHASES = [0, 0.35, 0.7];
// Pointer motion between two recorded targets is drawn, not recorded: the timeline marks these frames interpolated.
const MOVE_FRAMES = [1 / 3, 2 / 3];

type Point = { x: number; y: number };

/** The derivative of a masked capture: the agent's regions (in the capture's pixels), then the crop. */
export function deriveImage(masked: Raster, regions: GuideRegion[], crop: PixelBox | null): { raster: Raster } | { problem: string } {
  const problem = regions.map((region) => regionProblem(region, masked.width, masked.height)).find(Boolean)
    ?? (crop ? regionProblem(crop, masked.width, masked.height) : null);

  if (problem) {
    return { problem };
  }

  const raster = copyRaster(masked);

  regions.forEach((region) => applyRegion(raster, region));

  return { raster: crop ? cropRaster(raster, crop) : raster };
}

/** Why a GIF region does not fit: unknown frame index, or outside a frame it applies to. */
export function gifRegionProblem(frames: CapturedFrame[], regions: GuideRegion[]): string | null {
  for (const region of regions) {
    const unknown = (region.frames ?? []).find((index) => !frames[index]);

    if (unknown !== undefined) {
      return `Frame ${unknown} does not exist (0–${frames.length - 1}).`;
    }

    const problem = framesOf(frames, region).map((frame) => regionProblem(region, frame.raster.width, frame.raster.height)).find(Boolean);

    if (problem) {
      return problem;
    }
  }

  return null;
}

/** The GIF's frames: regions applied to the masked capture first, then scaled, then pointer and click drawn. */
export function composeGif(frames: CapturedFrame[], regions: GuideRegion[], maxWidth: number, zooms: GifZoom[] = []) {
  if (!frames.length) throw new Error("A GIF needs at least one captured frame.");
  const problem = zoomProblem(frames, zooms);
  if (problem) throw new Error(problem);
  const output: { raster: Raster; delayMs: number }[] = [];
  const keyFrames: Raster[] = [];
  const inspectionFrames: { raster: Raster; label: string }[] = [];
  const timeline: GuideTimelineStep[] = [];
  let previous: Point | null = null;
  let previousView = "";
  let previousCapture: { view: PixelBox; width: number; height: number; url: string | null } | null = null;
  const canvas = scaleDown(frames[0].raster, maxWidth).raster;

  for (const frame of frames) {
    const view = zooms.find((zoom) => zoom.frames.includes(frame.step.index));
    const viewKey = view ? `${view.x},${view.y},${view.width},${view.height}` : "overview";
    const clean = sanitized(frame, regions);
    const full = { x: 0, y: 0, width: clean.width, height: clean.height };
    const target = view ?? full;
    const samePage = frame.step.url !== null && previousCapture && previousCapture.url === frame.step.url && previousCapture.width === clean.width && previousCapture.height === clean.height;
    const camera = cameraViews(samePage && previousCapture ? previousCapture.view : full, target).map(box => ({ raster: zoomFrame(clean, box, canvas.width, canvas.height).raster, delayMs: CAMERA_FRAME_MS }));
    const rendered = zoomFrame(clean, target, canvas.width, canvas.height);
    const { raster: scaled, scale, left, top } = rendered;
    const point = frame.step.pointer;
    const inside = point && (!view || (point.x >= view.x && point.y >= view.y && point.x < view.x + view.width && point.y < view.y + view.height));
    const pointer = inside ? { x: (point.x - (view?.x ?? 0)) * scale + left, y: (point.y - (view?.y ?? 0)) * scale + top } : null;
    const moves = movementFrames(scaled, previousView === viewKey ? previous : null, pointer);
    const key = keyFrame(scaled, pointer);
    const pulse = pointer && frame.step.click ? CLICK_PHASES.map((phase) => ({ raster: keyFrame(scaled, pointer, phase), delayMs: CLICK_FRAME_MS })) : [];
    const delayMs = frame.step.tool === "final" ? FINAL_DELAY_MS : STEP_DELAY_MS;

    output.push(...camera, ...moves, ...pulse, { raster: key, delayMs: delayMs - pulse.length * CLICK_FRAME_MS });
    keyFrames.push(pulse[0]?.raster ?? key);
    if (camera.length) inspectionFrames.push({ raster: zoomFrame(clean, full, canvas.width, canvas.height).raster, label: `Step ${frame.step.index}: full sanitized source for checking everything revealed during the camera move (inspection only)` });
    inspectionFrames.push({ raster: pulse[0]?.raster ?? key, label: `Step ${frame.step.index}: final view` });
    timeline.push({ ...stepOf(frame), pointerInterpolated: moves.length > 0, delayMs, cameraTransitionMs: camera.length * CAMERA_FRAME_MS });
    previous = pointer;
    previousView = viewKey;
    previousCapture = { view: target, width: clean.width, height: clean.height, url: frame.step.url };
  }

  return { output, keyFrames, inspectionFrames, timeline };
}

function sanitized(frame: CapturedFrame, regions: GuideRegion[]): Raster {
  const raster = copyRaster(frame.raster);

  regions.filter((region) => !region.frames || region.frames.includes(frame.step.index)).forEach((region) => applyRegion(raster, region));

  return raster;
}

function framesOf(frames: CapturedFrame[], region: GuideRegion): CapturedFrame[] {
  return region.frames ? region.frames.map((index) => frames[index]) : frames;
}

function movementFrames(scaled: Raster, from: Point | null, to: Point | null): { raster: Raster; delayMs: number }[] {
  if (!from || !to || (from.x === to.x && from.y === to.y)) {
    return [];
  }

  return MOVE_FRAMES.map((t) => ({ raster: keyFrame(scaled, { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }), delayMs: MOVE_DELAY_MS }));
}

function keyFrame(scaled: Raster, pointer: Point | null, pulse?: number): Raster {
  const raster = copyRaster(scaled);

  if (pointer && pulse !== undefined) {
    drawClickPulse(raster, pointer.x, pointer.y, pulse);
  }

  if (pointer) {
    drawPointer(raster, pointer.x, pointer.y);
  }

  return raster;
}

function stepOf(frame: CapturedFrame): Omit<GuideTimelineStep, "pointerInterpolated" | "delayMs"> {
  const { click: _click, pointerInterpolated: _interpolated, ...step } = frame.step;

  return step;
}
