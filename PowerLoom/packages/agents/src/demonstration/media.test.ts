import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ToolDefinition } from "@agenttools/runtime";
import { guideZip } from "@powerloom/core";
import { GuideCapture } from "./capture/GuideCapture";
import { composeGif, deriveImage, gifRegionProblem } from "./media/derive";
import { encodeGif } from "./media/gif";
import type { Raster } from "./media/models/Raster";
import type { CapturedFrame } from "./models/CapturedFrame";
import { decodePng, encodePng } from "./media/raster";

const SECRET = [200, 30, 40, 255];
const PAGE = [250, 250, 250, 255];
const OWNER = "powerloom-run-9";

// 120×80 page with a "secret" block at 20,20 40×10 (the password field the page script reports).
function page(): Raster {
  const raster = { width: 120, height: 80, data: Buffer.alloc(120 * 80 * 4) };

  for (let pixel = 0; pixel < 120 * 80; pixel++) {
    const x = pixel % 120;
    const y = Math.floor(pixel / 120);
    const inside = x >= 20 && x < 60 && y >= 20 && y < 30;

    (inside ? SECRET : PAGE).forEach((value, channel) => { raster.data[pixel * 4 + channel] = value; });
  }

  return raster;
}

function countColor(raster: Raster, color: number[]): number {
  let count = 0;

  for (let offset = 0; offset < raster.data.length; offset += 4) {
    if (color.every((value, channel) => raster.data[offset + channel] === value))
      count++;
  }

  return count;
}

function browser(files: Map<string, Buffer>, calls: string[]) {
  const tool = (name: string, handler: (input: any) => Promise<{ text: string; isError?: boolean; images?: { data: string; mimeType: string }[] }>): ToolDefinition<any> => ({ name, description: "", input: {}, handler });
  const tools = [
    tool("browser_open", async () => ({ text: "open" })),
    tool("browser_close", async () => ({ text: "closed" })),
    tool("browser_evaluate", async (input) => input.target
      ? { text: "### Result\n{ \"x\": 40, \"y\": 25 }" }
      : { text: "### Result\n{ \"boxes\": [[20, 20, 40, 10]], \"scrollX\": 0, \"scrollY\": 0, \"page\": \"https://app.example.test/form\" }" }),
    tool("browser_take_screenshot", async (input) => {
      files.set(input.filename, encodePng(page()));
      return { text: "Saved " + input.filename, images: [{ data: "RAW-SCREENSHOT", mimeType: "image/png" }] };
    }),
    tool("browser_click", async (input) => { calls.push("click " + input.target); return { text: "clicked" }; }),
    tool("browser_type_secret", async () => { calls.push("secret"); return { text: "typed" }; }),
  ];
  const client = { browserImage: async (owner: string, caseName: string, file: string) => owner === OWNER && files.has(file) ? { ok: true, value: { base64: files.get(file)!.toString("base64") } } : { ok: false, message: "not found", denied: false } };

  return { tools, client };
}

async function openCapture(files = new Map<string, Buffer>(), calls: string[] = []) {
  const capture = new GuideCapture();
  const { tools, client } = browser(files, calls);

  capture.bind(OWNER, client as any, []);

  const wrapped = capture.wrap(tools);
  const run = (name: string, input: Record<string, unknown> = {}) => wrapped.find((t) => t.name === name)!.handler(input);

  await run("browser_open", { case: "demo.case" });

  return { capture, run, files, calls };
}

describe("solid and blur regions", () => {
  it("solid removes the source pixels from the exported raster and crop follows redaction", () => {
    const derived = deriveImage(page(), [{ x: 20, y: 20, width: 40, height: 10, style: "solid" }, { x: 30, y: 22, width: 5, height: 5, style: "solid" }], { x: 10, y: 10, width: 60, height: 40 });

    assert.ok("raster" in derived);
    const exported = decodePng(encodePng(derived.raster));
    assert.equal(exported.width, 60);
    assert.equal(countColor(exported, SECRET), 0);
    assert.ok(countColor(exported, PAGE) > 0, "unrelated pixels stay");
  });

  it("refuses out-of-bounds, fractional and empty regions or crops", () => {
    for (const region of [{ x: 100, y: 0, width: 30, height: 5 }, { x: 1.5, y: 0, width: 3, height: 3 }, { x: 0, y: 0, width: 0, height: 3 }]) {
      assert.ok("problem" in deriveImage(page(), [{ ...region, style: "solid" }], null));
    }

    assert.ok("problem" in deriveImage(page(), [], { x: 0, y: 70, width: 20, height: 20 }));
  });

  it("blur changes the region without claiming removal", () => {
    const derived = deriveImage(page(), [{ x: 16, y: 16, width: 48, height: 16, style: "blur" }], null);

    assert.ok("raster" in derived);
    assert.ok(countColor(derived.raster, SECRET) < 40 * 10);
  });
});

describe("capture boundary", () => {
  it("masks the screenshot before the agent sees it and never passes the raw image through", async () => {
    const { run, capture } = await openCapture();
    const result = await run("browser_take_screenshot", { filename: "01-form.png", scale: "device" });

    assert.equal(result.isError, undefined);
    assert.equal(result.images!.length, 1);
    assert.notEqual(result.images![0].data, "RAW-SCREENSHOT");
    assert.equal(countColor(decodePng(Buffer.from(result.images![0].data, "base64")), SECRET), 0);
    assert.match(result.text, /01-form\.png/);
    assert.equal(capture.record("demo.case", "01-form.png")!.masks.length, 1);
  });

  it("re-reads the masked capture and refuses a changed file", async () => {
    const { run, capture, files } = await openCapture();

    await run("browser_take_screenshot", { filename: "01-form.png" });
    const read = await capture.readMasked("demo.case", "01-form.png");
    assert.ok("raster" in read && countColor(read.raster, SECRET) === 0);

    files.set("01-form.png", encodePng({ ...page(), data: Buffer.alloc(120 * 80 * 4, 7) }));
    assert.ok("problem" in await capture.readMasked("demo.case", "01-form.png"));
    assert.ok("problem" in await capture.readMasked("demo.case", "never-taken.png"));
  });

  it("refuses element screenshots, path filenames and an unknown mask location", async () => {
    const { run } = await openCapture();

    assert.equal((await run("browser_take_screenshot", { target: "e3" })).isError, true);
    assert.equal((await run("browser_take_screenshot", { filename: "../x.png" })).isError, true);

    const capture = new GuideCapture();
    const { tools, client } = browser(new Map(), []);
    const broken = tools.map((t) => t.name === "browser_evaluate" ? { ...t, handler: async () => ({ text: "no object" }) } : t);
    capture.bind(OWNER, client as any, []);
    const wrapped = capture.wrap(broken);
    await wrapped.find((t) => t.name === "browser_open")!.handler({ case: "demo" });
    const refused = await wrapped.find((t) => t.name === "browser_take_screenshot")!.handler({});
    assert.equal(refused.isError, true);
    assert.equal(refused.images, undefined);
  });
});

describe("GIF segments", () => {
  it("captures a masked frame before each action, hides secrets, and encodes a GIF without the secret pixels", async () => {
    const { run, capture, calls } = await openCapture();

    assert.equal(capture.startGif("save-form"), null);
    await run("browser_click", { target: "e5", element: "Save" });
    await run("browser_type_secret", { target: "e6", element: "Password", valueName: "app-password" });
    const stopped = await capture.stopGif("save-form");

    assert.ok(!("problem" in stopped));
    assert.deepEqual(calls, ["click e5", "secret"]);
    assert.equal(stopped.frames.length, 3);
    assert.deepEqual(stopped.frames[0].step.pointer, { x: 40, y: 25 });
    assert.equal(stopped.frames[1].step.value, null);
    assert.match(stopped.frames[1].step.label, /value hidden/);

    const composed = composeGif(stopped.frames, [{ x: 0, y: 0, width: 10, height: 10, style: "solid", frames: [2] }], 960);
    assert.ok(composed.output.every(({ raster }) => countColor(raster, SECRET) === 0), "every movement and pulse frame stays redacted");
    assert.equal(composed.timeline.length, 3);
    assert.equal(composed.timeline[2].delayMs, 2500);

    const gif = encodeGif(composed.output);
    assert.equal(gif.subarray(0, 6).toString("latin1"), "GIF89a");
    assert.equal(gif.includes(Buffer.from("XMP")), false);
  });

  it("refuses unknown frame indices and out-of-frame regions, and caps a segment at 12 steps", async () => {
    const { run, capture, calls } = await openCapture();

    capture.startGif("long");
    for (let step = 0; step < 12; step++) await run("browser_click", { target: "e" + step });
    const refused = await run("browser_click", { target: "e99" });
    assert.equal(refused.isError, true);
    assert.equal(calls.includes("click e99"), false, "a refused step does not run");

    const stopped = await capture.stopGif("long");
    assert.ok(!("problem" in stopped));
    assert.ok(gifRegionProblem(stopped.frames, [{ x: 0, y: 0, width: 5, height: 5, style: "solid", frames: [40] }]));
    assert.ok(gifRegionProblem(stopped.frames, [{ x: 110, y: 0, width: 20, height: 5, style: "solid" }]));
  });
});

describe("portable GIF packages", () => {
  it("accepts GIF paths in the archive and still refuses other media", () => {
    assert.doesNotThrow(() => guideZip([{ path: "images/save-form.gif", content: Buffer.from("GIF89a") }]));
    assert.throws(() => guideZip([{ path: "images/raw.webm", content: Buffer.from("x") }]));
  });
});

describe("GIF click pulses", () => {
  function frame(click: boolean, pointer: { x: number; y: number } | null): CapturedFrame {
    return { raster: page(), rawSha256: "synthetic", masks: 0, step: { index: 0, tool: "browser_click", label: "Save", value: null, url: "https://app.example.test", pointer, pointerInterpolated: false, click } };
  }

  it("shows a brief expanding and fading pulse, then holds only the cursor without extending the step", () => {
    const input = frame(true, { x: 80, y: 40 });
    const animated = composeGif([input], [], 960);
    const quiet = composeGif([frame(false, input.step.pointer)], [], 960);

    assert.equal(animated.output.reduce((sum, output) => sum + output.delayMs, 0), 1200);
    assert.equal(animated.output.slice(0, -1).reduce((sum, output) => sum + output.delayMs, 0), 180);
    assert.deepEqual(animated.output.at(-1)!.raster.data, quiet.output[0].raster.data, "the pulse vanishes before the long hold");
    assert.notDeepEqual(animated.output[0].raster.data, animated.output[1].raster.data, "the pulse animates");
    assert.ok(animated.output.every(({ raster }) => countColor(raster, [230, 57, 70, 255]) === 0), "no persistent red marker");
    const at = (index: number, x: number) => [...animated.output[index].raster.data.subarray((40 * 120 + x) * 4, (40 * 120 + x) * 4 + 4)];
    assert.ok(at(0, 72)[0] < at(2, 63)[0], "the expanding blue pulse fades toward the page color");
    assert.deepEqual(at(3, 72), PAGE);
    assert.equal(animated.timeline[0].delayMs, 1200);
  });

  it("keeps typing, missing targets and the final state free of pulses, and clips at viewport edges", () => {
    const typing = frame(false, { x: 80, y: 40 });
    typing.step.tool = "browser_type";
    const final = frame(false, typing.step.pointer);
    final.step.tool = "final";
    const still = composeGif([typing, final], [], 960);
    assert.deepEqual(still.output.map(({ delayMs }) => delayMs), [1200, 2500]);
    assert.equal(composeGif([frame(true, null)], [], 960).output.length, 1);
    for (const pointer of [{ x: 0, y: 0 }, { x: 119, y: 79 }]) {
      const edge = composeGif([frame(true, pointer)], [], 960);
      assert.ok(edge.output.every(({ raster }) => raster.data.length === 120 * 80 * 4));
    }
  });
});
