import { defineTool } from "@agenttools/runtime";
import type { GuideRegion } from "@powerloom/core";
import { z } from "zod";
import type { CapturedFrame } from "./models/CapturedFrame";
import type { GuideMediaHost } from "./models/GuideMediaHost";
import { composeGif, gifRegionProblem } from "./media/derive";
import { encodeGif } from "./media/gif";
import { encodePng } from "./media/raster";
import { REGION_INPUT } from "./imageTools";

const SEGMENT = z.string().regex(/^[a-z0-9][a-z0-9-]{0,40}$/).describe("Segment name; the GIF is saved as images/<name>.gif");

// start/stop/add_guide_gif: a GIF built from the masked frames captured before each recorded browser action. Nothing
// is replayed: encoding works on the frames already captured.
export function gifTools(host: GuideMediaHost) {
  return [
    defineTool({
      name: "start_guide_gif",
      description: "Start recording a GIF segment in the open browser case. Until stop_guide_gif, a masked frame is captured before each click, typing, form fill, selection, key press or navigation (at most 12 steps). Secret typing is recorded only as a hidden step.",
      input: { name: SEGMENT },
      handler: async (input) => {
        const problem = host.mediaProblem() ?? host.capture.startGif(input.name);

        return problem ? error(problem) : { text: `Recording ${input.name}. Do the workflow's steps, then stop_guide_gif.` };
      },
    }),
    defineTool({
      name: "stop_guide_gif",
      description: "Stop the segment: captures the final state and shows every frame (masked, in CSS pixels) with its step, so you can choose regions for add_guide_gif.",
      input: { name: SEGMENT },
      handler: async (input) => {
        const stopped = host.mediaProblem() ? { problem: host.mediaProblem()! } : await host.capture.stopGif(input.name);

        if ("problem" in stopped) {
          return error(stopped.problem);
        }

        return {
          text: `Segment ${input.name}: ${stopped.frames.length} frames.\n${stopped.frames.map(frameLine).join("\n")}\nInspect each frame; then add_guide_gif with regions (frames: indices, or omit for all).`,
          images: stopped.frames.map((frame) => ({ data: encodePng(frame.raster).toString("base64"), mimeType: "image/png" })),
        };
      },
    }),
    defineTool({
      name: "add_guide_gif",
      description: "Build images/<name>.gif from the stopped segment: regions first (per frame or all), then scaling, then the drawn pointer (interpolated between targets), brief fading click pulses and pauses. Returns the key frames to inspect; approve with approve_guide_image. Keep a static screenshot and the written steps next to every GIF.",
      input: {
        name: SEGMENT, caption: z.string().min(1), alt: z.string().min(1), buildIdentity: z.string().min(1),
        regions: z.array(REGION_INPUT.extend({ frames: z.array(z.number().int().min(0)).min(1).optional() })).max(40).default([]),
        maxWidth: z.number().int().min(320).max(1280).default(960),
      },
      handler: async (input) => {
        const blocked = host.mediaProblem();
        const recording = blocked ? null : host.capture.stoppedGif(input.name);

        if (!recording) {
          return error(blocked ?? `Stop segment ${input.name} with stop_guide_gif first.`);
        }

        const regions: GuideRegion[] = input.regions ?? [];
        const problem = gifRegionProblem(recording.frames, regions);

        if (problem) {
          return error(problem);
        }

        const composed = composeGif(recording.frames, regions, input.maxWidth ?? 960);
        const content = encodeGif(composed.output);
        const first = composed.keyFrames[0];
        const saved = await host.saveMedia({
          name: input.name + ".gif", mediaType: "image/gif", width: first.width, height: first.height, caption: input.caption, alt: input.alt,
          source: "recording:" + input.name, sourceCase: recording.caseName, buildIdentity: input.buildIdentity, approved: false,
          transform: { sourceSha256: recording.frames.map((frame) => frame.rawSha256), captureMasks: maskCount(recording.frames), regions, crop: null, scale: first.width / recording.frames[0].raster.width },
          timeline: composed.timeline,
        }, content);

        if ("problem" in saved) {
          return error(saved.problem);
        }

        return {
          text: `images/${saved.name} saved (${saved.width}×${saved.height}, ${composed.output.length} frames, ${saved.bytes} bytes, sha256 ${saved.sha256}). These are its key frames; the frames between them move the pointer and fade a brief click pulse. If no sensitive value shows, call approve_guide_image with this name and sha256.`,
          images: composed.keyFrames.map((raster) => ({ data: encodePng(raster).toString("base64"), mimeType: "image/png" })),
        };
      },
    }),
  ];
}

function frameLine(frame: CapturedFrame): string {
  const value = frame.step.value ? ` = ${frame.step.value}` : "";

  return `${frame.step.index}: ${frame.step.tool === "final" ? "final state" : "before " + frame.step.label + value}${frame.step.pointer ? "" : " (no pointer position)"}`;
}

function maskCount(frames: CapturedFrame[]): number {
  return frames.reduce((sum, frame) => sum + frame.masks, 0);
}

const error = (text: string) => ({ text, isError: true });
