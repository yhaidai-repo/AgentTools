import { defineTool } from "@agenttools/runtime";
import type { GuideRegion } from "@powerloom/core";
import { z } from "zod";
import type { ReadLog } from "../evidence/ReadLog";
import { deriveImage } from "./media/derive";
import { encodePng } from "./media/raster";
import type { GuideMediaHost } from "./models/GuideMediaHost";

const box = { x: z.number().int().min(0), y: z.number().int().min(0), width: z.number().int().min(1), height: z.number().int().min(1) };
export const REGION_INPUT = z.object({ ...box, style: z.enum(["solid", "blur"]).describe("solid removes the pixels (passwords, OTPs, QR codes, identifiers); blur is a coarse mosaic that hides detail but is not removal") });

// add_guide_image and approve_guide_image: a masked screenshot of this run becomes a stored, flattened derivative.
export function imageTools(host: GuideMediaHost, log: ReadLog) {
  return [
    defineTool({
      name: "add_guide_image",
      description: "Import a screenshot this run took with browser_take_screenshot, as the masked image you saw. Optional regions (solid or blur, in the screenshot's own CSS pixels, top-left origin) and crop are applied in that order to a new flattened PNG; the raw capture stays on the DevHub host. Without regions or crop the image is approved at once; otherwise view the returned preview and call approve_guide_image.",
      input: {
        case: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/), file: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]*\.png$/),
        name: z.string().regex(/^[a-z0-9][a-z0-9-]*\.png$/), caption: z.string().min(1), alt: z.string().min(1),
        source: z.string().regex(/^S\d+$/), buildIdentity: z.string().min(1), inspected: z.literal(true), sanitized: z.literal(true),
        regions: z.array(REGION_INPUT).max(20).default([]),
        crop: z.object(box).optional(),
      },
      handler: async (input) => {
        const blocked = host.mediaProblem() ?? sourceProblem(log, input.source, input.file);

        if (blocked) {
          return error(blocked);
        }

        const read = await host.capture.readMasked(input.case, input.file);

        if ("problem" in read) {
          return error(read.problem);
        }

        const regions: GuideRegion[] = input.regions ?? [];
        const derived = deriveImage(read.raster, regions, input.crop ?? null);

        if ("problem" in derived) {
          return error(derived.problem);
        }

        const content = encodePng(derived.raster);
        const approved = regions.length === 0 && !input.crop;
        const saved = await host.saveMedia({
          name: input.name, mediaType: "image/png", width: derived.raster.width, height: derived.raster.height, caption: input.caption, alt: input.alt,
          source: input.source, sourceCase: input.case, buildIdentity: input.buildIdentity, approved,
          transform: { sourceSha256: [read.record.rawSha256], captureMasks: read.record.masks.length, regions, crop: input.crop ?? null, scale: 1 },
        }, content);

        if ("problem" in saved) {
          return error(saved.problem);
        }

        const summary = `images/${saved.name} saved (${saved.width}×${saved.height}, sha256 ${saved.sha256}).`;

        if (approved) {
          return { text: `Approved image ${summary}` };
        }

        return {
          text: `${summary} View this preview; if every sensitive value is gone and the labels stay readable, call approve_guide_image with this name and sha256. Otherwise call add_guide_image again with other regions.`,
          images: [{ data: content.toString("base64"), mimeType: "image/png" }],
        };
      },
    }),
    defineTool({
      name: "approve_guide_image",
      description: "Approve a saved image or GIF after viewing its preview. Approval belongs to these exact bytes: any new add_guide_image/add_guide_gif under the name needs a new approval, and a ready guide must be written again.",
      input: { name: z.string().regex(/^[a-z0-9][a-z0-9-]*\.(?:png|gif)$/), sha256: z.string().regex(/^[a-f0-9]{64}$/) },
      handler: async (input) => {
        const blocked = host.mediaProblem();

        if (blocked) {
          return error(blocked);
        }

        const approved = await host.approveMedia(input.name, input.sha256);

        return "problem" in approved ? error(approved.problem) : { text: `Approved images/${approved.name}.` };
      },
    }),
  ];
}

function sourceProblem(log: ReadLog, source: string, file: string): string | null {
  const read = log.find(source);

  if (read?.tool !== "browser_take_screenshot" || !read.fresh || !(read.resultText ?? "").includes(file)) {
    return "Cite the screenshot result naming this file.";
  }

  return null;
}

const error = (text: string) => ({ text, isError: true });
