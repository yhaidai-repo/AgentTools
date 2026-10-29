import { PNG } from "pngjs";
import type { Raster } from "./models/Raster";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function isPng(bytes: Buffer): boolean {
  return bytes.length >= 24 && bytes.subarray(0, 8).equals(PNG_SIGNATURE) && bytes.toString("latin1", 12, 16) === "IHDR";
}

export function decodePng(bytes: Buffer): Raster {
  const png = PNG.sync.read(bytes);

  return { width: png.width, height: png.height, data: Buffer.from(png.data) };
}

/** The decoded PNG, or null for a damaged or non-PNG file (the tools report it instead of failing the run). */
export function tryDecodePng(bytes: Buffer): Raster | null {
  if (!isPng(bytes)) {
    return null;
  }

  try {
    return decodePng(bytes);
  } catch {
    return null;
  }
}

// Writes only IHDR/IDAT/IEND: no text chunks, thumbnails or other metadata from the source survive.
export function encodePng(raster: Raster): Buffer {
  const png = new PNG({ width: raster.width, height: raster.height });

  raster.data.copy(png.data);

  return PNG.sync.write(png, { colorType: 6 });
}

export function copyRaster(raster: Raster): Raster {
  return { width: raster.width, height: raster.height, data: Buffer.from(raster.data) };
}

export function cropRaster(raster: Raster, crop: { x: number; y: number; width: number; height: number }): Raster {
  const data = Buffer.alloc(crop.width * crop.height * 4);

  for (let row = 0; row < crop.height; row++) {
    const from = ((crop.y + row) * raster.width + crop.x) * 4;

    raster.data.copy(data, row * crop.width * 4, from, from + crop.width * 4);
  }

  return { width: crop.width, height: crop.height, data };
}

/** Box-averages the raster down to at most maxWidth; returns it unchanged when it is already narrow enough. */
export function scaleDown(raster: Raster, maxWidth: number): { raster: Raster; scale: number } {
  if (raster.width <= maxWidth) {
    return { raster, scale: 1 };
  }

  const scale = maxWidth / raster.width;
  const width = maxWidth;
  const height = Math.max(1, Math.round(raster.height * scale));
  const data = Buffer.alloc(width * height * 4);

  for (let pixel = 0; pixel < width * height; pixel++) {
    writeAverage(raster, data, pixel * 4, sourceBox(pixel % width, Math.floor(pixel / width), scale, raster));
  }

  return { raster: { width, height, data }, scale };
}

function sourceBox(x: number, y: number, scale: number, raster: Raster) {
  return {
    x0: Math.floor(x / scale),
    y0: Math.floor(y / scale),
    x1: Math.min(raster.width, Math.ceil((x + 1) / scale)),
    y1: Math.min(raster.height, Math.ceil((y + 1) / scale)),
  };
}

function writeAverage(raster: Raster, target: Buffer, offset: number, box: { x0: number; y0: number; x1: number; y1: number }): void {
  const sum = [0, 0, 0, 0];
  const boxWidth = box.x1 - box.x0;
  const count = Math.max(1, boxWidth * (box.y1 - box.y0));

  for (let pixel = 0; pixel < count; pixel++) {
    addPixel(sum, raster.data, ((box.y0 + Math.floor(pixel / boxWidth)) * raster.width + box.x0 + (pixel % boxWidth)) * 4);
  }

  for (let channel = 0; channel < 4; channel++) {
    target[offset + channel] = Math.round(sum[channel] / count);
  }
}

function addPixel(sum: number[], data: Buffer, offset: number): void {
  for (let channel = 0; channel < 4; channel++) {
    sum[channel] += data[offset + channel];
  }
}
