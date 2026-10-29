import type { Raster } from "./models/Raster";
import type { PixelBox } from "./models/PixelBox";
import { regionProblem } from "./regions";

export type GifZoom = PixelBox & { frames: number[] };

export function zoomProblem(frames: { raster: Raster }[], zooms: GifZoom[]): string | null {
  const seen = new Set<number>();
  for (const zoom of zooms) {
    if (!zoom.frames.length) return "Select at least one frame to zoom.";
    for (const index of zoom.frames) {
      if (!Number.isInteger(index) || !frames[index]) return `Unknown zoom frame ${index}.`;
      if (seen.has(index)) return `Frame ${index} has more than one zoom.`;
      seen.add(index);
      const problem = regionProblem(zoom, frames[index].raster.width, frames[index].raster.height);
      if (problem) return problem;
    }
  }
  return null;
}

/** Fit a sanitized viewport into a fixed GIF canvas; letterboxing preserves proportions. */
export function zoomFrame(source: Raster, view: PixelBox, width: number, height: number) {
  const scale = Math.min(width / view.width, height / view.height);
  const drawnWidth = Math.max(1, Math.round(view.width * scale));
  const drawnHeight = Math.max(1, Math.round(view.height * scale));
  const left = Math.floor((width - drawnWidth) / 2), top = Math.floor((height - drawnHeight) / 2);
  const raster: Raster = { width, height, data: Buffer.alloc(width * height * 4) };
  for (let offset = 0; offset < raster.data.length; offset += 4) {
    raster.data[offset] = raster.data[offset + 1] = raster.data[offset + 2] = 24;
    raster.data[offset + 3] = 255;
  }
  for (let y = 0; y < drawnHeight; y++) for (let x = 0; x < drawnWidth; x++) {
    const sx = view.x + Math.min(view.width - 1, Math.floor(x / scale));
    const sy = view.y + Math.min(view.height - 1, Math.floor(y / scale));
    const from = (sy * source.width + sx) * 4, to = ((top + y) * width + left + x) * 4;
    if (scale >= 1) {
      source.data.copy(raster.data, to, from, from + 4);
    } else {
      // Average when reducing a viewport so overview text does not acquire sampling gaps.
      const right = Math.min(view.x + view.width, view.x + Math.ceil((x + 1) / scale));
      const bottom = Math.min(view.y + view.height, view.y + Math.ceil((y + 1) / scale));
      const sum = [0, 0, 0, 0];
      let count = 0;
      for (let row = sy; row < bottom; row++) for (let column = sx; column < right; column++) {
        const offset = (row * source.width + column) * 4;
        for (let channel = 0; channel < 4; channel++) sum[channel] += source.data[offset + channel];
        count++;
      }
      for (let channel = 0; channel < 4; channel++) raster.data[to + channel] = Math.round(sum[channel] / count);
    }
  }
  return { raster, scale, left, top };
}
