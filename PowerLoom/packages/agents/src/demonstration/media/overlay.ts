import type { Raster } from "./models/Raster";
import { writePixel } from "./regions";

// The pointer drawn on GIF frames: X outline, . fill; the tip is the top-left pixel.
const ARROW = [
  "X",
  "XX",
  "X.X",
  "X..X",
  "X...X",
  "X....X",
  "X.....X",
  "X......X",
  "X.......X",
  "X........X",
  "X.....XXXXX",
  "X..X..X",
  "X.X X..X",
  "XX  X..X",
  "X    X..X",
  "     X..X",
  "      XX",
];
const OUTLINE = [0, 0, 0, 255];
const FILL = [255, 255, 255, 255];
const CLICK = [59, 130, 246];

export function drawPointer(raster: Raster, x: number, y: number): void {
  const cells = ARROW.flatMap((row, dy) => [...row].map((cell, dx) => ({ cell, dx, dy })));

  for (const { cell, dx, dy } of cells.filter(({ cell }) => cell !== " ")) {
    writePixel(raster, Math.round(x) + dx, Math.round(y) + dy, cell === "X" ? OUTLINE : FILL);
  }
}

/** A short blue pulse expands and fades over the already sanitized pixels. */
export function drawClickPulse(raster: Raster, x: number, y: number, progress: number): void {
  const radius = 8 + progress * 14;
  const opacity = 0.75 * (1 - progress);
  const bound = Math.ceil(radius);

  for (let dy = -bound; dy <= bound; dy++) {
    for (let dx = -bound; dx <= bound; dx++) {
      const distance = Math.hypot(dx, dy);
      const px = Math.round(x) + dx;
      const py = Math.round(y) + dy;

      if (distance > radius || distance <= radius - 2 || px < 0 || py < 0 || px >= raster.width || py >= raster.height) continue;

      const offset = (py * raster.width + px) * 4;
      const color = CLICK.map((channel, index) => Math.round(channel * opacity + raster.data[offset + index] * (1 - opacity)));
      writePixel(raster, px, py, [...color, raster.data[offset + 3]]);
    }
  }
}
