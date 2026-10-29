/// <reference path="./gifenc.d.ts" />
import gifenc from "gifenc";
import type { Raster } from "./models/Raster";

// gifenc is CommonJS bundled by esbuild: Node's ESM loader sees no named exports, only the default.
const { GIFEncoder, applyPalette, quantize } = gifenc;

/** Encodes already sanitized, composited frames; a frame's delay is in milliseconds. Loops forever, no metadata. */
export function encodeGif(frames: { raster: Raster; delayMs: number }[]): Buffer {
  const gif = GIFEncoder();

  for (const frame of frames) {
    const rgba = new Uint8Array(frame.raster.data.buffer, frame.raster.data.byteOffset, frame.raster.data.length);
    const palette = quantize(rgba, 256);

    gif.writeFrame(applyPalette(rgba, palette), frame.raster.width, frame.raster.height, { palette, delay: frame.delayMs, repeat: 0 });
  }

  gif.finish();

  return Buffer.from(gif.bytes());
}
