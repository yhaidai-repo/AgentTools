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
const CLICK = [230, 57, 70, 255];
const CLICK_RADIUS = 14;
const CLICK_WIDTH = 3;

export function drawPointer(raster: Raster, x: number, y: number): void {
  const cells = ARROW.flatMap((row, dy) => [...row].map((cell, dx) => ({ cell, dx, dy })));

  for (const { cell, dx, dy } of cells.filter(({ cell }) => cell !== " ")) {
    writePixel(raster, Math.round(x) + dx, Math.round(y) + dy, cell === "X" ? OUTLINE : FILL);
  }
}

/** A ring around the clicked point: the click indicator. */
export function drawClick(raster: Raster, x: number, y: number): void {
  const size = CLICK_RADIUS * 2 + 1;

  for (let pixel = 0; pixel < size * size; pixel++) {
    const dx = (pixel % size) - CLICK_RADIUS;
    const dy = Math.floor(pixel / size) - CLICK_RADIUS;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= CLICK_RADIUS && distance > CLICK_RADIUS - CLICK_WIDTH)
      writePixel(raster, Math.round(x) + dx, Math.round(y) + dy, CLICK);
  }
}
