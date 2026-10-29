import assert from "node:assert/strict";
import { it } from "node:test";
import { composeGif } from "./media/derive";
import { zoomFrame, zoomProblem } from "./media/zoom";
import type { CapturedFrame } from "./models/CapturedFrame";
import { cameraViews } from "./media/camera";

function frame(index: number, width = 120, height = 80): CapturedFrame {
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < data.length; i += 4) data.set([210, 70, 90, 255], i);
  return { raster: { width, height, data }, rawSha256: "synthetic", masks: 0,
    step: { index, tool: "browser_click", label: "Save", value: null, url: "https://example.test", pointer: null, pointerInterpolated: false, click: false } };
}
const crop = { x: 20, y: 10, width: 60, height: 40 };
const pixel = (f: { width: number; data: Buffer }, x: number, y: number) => [...f.data.subarray((y * f.width + x) * 4, (y * f.width + x) * 4 + 4)];

it("enlarges a selected control, restores overview, and preserves masks in every zoomed frame", () => {
  const frames = [frame(0), frame(1), frame(2)];
  frames[1].step.pointer = { x: 60, y: 30 };
  frames[1].step.click = true;
  const result = composeGif(frames, [{ x: 20, y: 10, width: 10, height: 10, style: "solid" }], 960, [{ ...crop, frames: [1] }]);
  assert.ok(result.output.every(({ raster }) => raster.width === 120 && raster.height === 80));
  assert.deepEqual(pixel(result.keyFrames[1], 1, 1), [32, 32, 32, 255], "mask was enlarged with the crop");
  assert.deepEqual(pixel(result.keyFrames[0], 1, 1), [210, 70, 90, 255]);
  assert.deepEqual(result.keyFrames[0].data, result.keyFrames[2].data, "overview returns without stale pointer");
  assert.deepEqual(result.timeline.map(s => s.pointerInterpolated), [false, false, false]);
  assert.equal(result.timeline[1].cameraTransitionMs, 300);
  assert.equal(result.timeline[2].cameraTransitionMs, 300);
});

it("maps pointer positions through zoom and suppresses pointers outside the crop", () => {
  const input = frame(0);
  input.step.pointer = { x: 30, y: 20 };
  const result = composeGif([input], [], 960, [{ ...crop, frames: [0] }]);
  const expected = frame(0);
  expected.step.pointer = { x: 20, y: 20 };
  assert.deepEqual(result.keyFrames[0].data, composeGif([expected], [], 960).keyFrames[0].data);
  input.step.pointer = { x: 19, y: 20 };
  input.step.click = true;
  assert.equal(composeGif([input], [], 960, [{ ...crop, frames: [0] }]).output.length, 6, "only five camera frames and one hold, no off-crop click pulse");
});

it("letterboxes different aspect ratios and viewport sizes into a constant canvas", () => {
  const result = zoomFrame(frame(0).raster, { x: 0, y: 0, width: 20, height: 80 }, 120, 80);
  assert.equal(result.left, 50);
  assert.deepEqual(pixel(result.raster, 0, 0), [24, 24, 24, 255]);
  assert.deepEqual(pixel(result.raster, 50, 0), [210, 70, 90, 255]);
  assert.ok(composeGif([frame(0), frame(1, 80, 120)], [], 960).output.every(({ raster }) => raster.width === 120 && raster.height === 80));
});

it("keeps thin strokes when shrinking an overview", () => {
  const input = frame(0, 640, 80);
  for (let y = 0; y < 80; y++) input.raster.data.set([0, 0, 0, 255], (y * 640 + 1) * 4);
  const result = composeGif([input], [], 320);
  assert.deepEqual(pixel(result.keyFrames[0], 0, 0), [105, 35, 45, 255], "both source columns contribute");
});

it("refuses invalid, missing, overlapping and out-of-bounds zoom selections", () => {
  const frames = [frame(0)];
  for (const framesToZoom of [[], [1], [-1], [0.5], [0, 0]]) {
    assert.ok(zoomProblem(frames, [{ ...crop, frames: framesToZoom }]));
  }
  assert.ok(zoomProblem(frames, [{ ...crop, frames: [0] }, { ...crop, frames: [0] }]));
  assert.ok(zoomProblem(frames, [{ ...crop, x: 100, frames: [0] }]));
  assert.throws(() => composeGif([], [], 960), /at least one/);
  assert.throws(() => composeGif(frames, [], 960, [{ ...crop, frames: [7] }]), /Unknown/);
});

it("eases between valid crops, holds the readable view, and draws the click only after motion", () => {
  const from = { x: 0, y: 0, width: 120, height: 80 };
  const views = cameraViews(from, crop);
  assert.equal(views.length, 5);
  assert.ok(views.every(v => v.width >= crop.width && v.width <= from.width && v.x + v.width <= 120 && v.y + v.height <= 80));
  assert.ok(views[0].width - views[1].width < views[1].width - views[2].width, "camera accelerates gently");
  assert.deepEqual(cameraViews(crop, crop), []);
  const input = frame(0);
  input.step.pointer = { x: 50, y: 30 };
  input.step.click = true;
  const composed = composeGif([input], [], 960, [{ ...crop, frames: [0] }]);
  assert.deepEqual(composed.output.slice(0, 5).map(f => f.delayMs), [60, 60, 60, 60, 60]);
  assert.equal(composed.output.slice(5).reduce((sum, f) => sum + f.delayMs, 0), 1200, "the readable hold is not shortened by the camera");
  assert.equal(composed.inspectionFrames.length, 2, "includes full-source privacy preview and final view");
  for (const output of composed.output.slice(0, 5)) {
    for (let offset = 0; offset < output.raster.data.length; offset += 4) {
      const rgba = [...output.raster.data.subarray(offset, offset + 4)];
      assert.ok(rgba.join(",") === "210,70,90,255" || rgba.join(",") === "24,24,24,255", "only page pixels or letterboxing, no cursor or pulse during motion");
    }
  }
});

it("keeps every camera frame redacted and does not morph screenshots across pages", () => {
  const input = frame(0);
  const composed = composeGif([input], [{ x: 0, y: 0, width: 120, height: 80, style: "solid" }], 960, [{ ...crop, frames: [0] }]);
  assert.ok(composed.output.every(f => !f.raster.data.includes(210)), "sanitization precedes every camera render");
  const next = frame(1);
  next.step.url = "https://other.example.test";
  const changed = composeGif([input, next], [], 960, [{ ...crop, frames: [0] }]);
  assert.equal(changed.timeline[1].cameraTransitionMs, 0, "a new page starts in its own overview");
});
