import type { GuideRegion } from "@powerloom/core";
import type { Raster } from "./models/Raster";
import type { PixelBox } from "./models/PixelBox";

const SOLID = [32, 32, 32, 255];
// Blur here is a coarse mosaic: it hides detail but is not removal; passwords, OTPs, QR codes and identifiers use solid.
const BLUR_BLOCK = 16;

/** Why the region does not fit the image in its own pixels (top-left origin), or null. */
export function regionProblem(region: PixelBox, width: number, height: number): string | null {
  const values = [region.x, region.y, region.width, region.height];

  if (!values.every(Number.isInteger)) {
    return "Region coordinates must be whole pixels.";
  }

  if (region.width < 1 || region.height < 1 || region.x < 0 || region.y < 0) {
    return "Region needs a positive size and a non-negative origin.";
  }

  if (region.x + region.width > width || region.y + region.height > height) {
    return `Region ${region.x},${region.y} ${region.width}×${region.height} leaves the ${width}×${height} image.`;
  }

  return null;
}

export function applyRegion(raster: Raster, region: PixelBox & { style: GuideRegion["style"] }): void {
  if (region.style === "solid") {
    fillBox(raster, region, SOLID);

    return;
  }

  mosaic(raster, region);
}

export function fillBox(raster: Raster, box: PixelBox, color: number[]): void {
  for (let pixel = 0; pixel < box.width * box.height; pixel++) {
    writePixel(raster, box.x + (pixel % box.width), box.y + Math.floor(pixel / box.width), color);
  }
}

function mosaic(raster: Raster, region: PixelBox): void {
  const columns = Math.ceil(region.width / BLUR_BLOCK);
  const rows = Math.ceil(region.height / BLUR_BLOCK);

  for (let block = 0; block < columns * rows; block++) {
    const x = region.x + (block % columns) * BLUR_BLOCK;
    const y = region.y + Math.floor(block / columns) * BLUR_BLOCK;
    const box = { x, y, width: Math.min(BLUR_BLOCK, region.x + region.width - x), height: Math.min(BLUR_BLOCK, region.y + region.height - y) };

    fillBox(raster, box, averageOf(raster, box));
  }
}

function averageOf(raster: Raster, box: PixelBox): number[] {
  const sum = [0, 0, 0, 0];
  const count = box.width * box.height;

  for (let pixel = 0; pixel < count; pixel++) {
    const offset = ((box.y + Math.floor(pixel / box.width)) * raster.width + box.x + (pixel % box.width)) * 4;

    sum.forEach((_, channel) => { sum[channel] += raster.data[offset + channel]; });
  }

  return sum.map((value) => Math.round(value / count));
}

export function writePixel(raster: Raster, x: number, y: number, color: number[]): void {
  if (x < 0 || y < 0 || x >= raster.width || y >= raster.height) {
    return;
  }

  const offset = (y * raster.width + x) * 4;

  color.forEach((value, channel) => { raster.data[offset + channel] = value; });
}
