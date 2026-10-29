import type { PixelBox } from "./models/PixelBox";

export const CAMERA_FRAME_MS = 60;

/** A short eased camera move; source screenshots are never blended or reconstructed. */
export function cameraViews(from: PixelBox, to: PixelBox): PixelBox[] {
  if (from.x === to.x && from.y === to.y && from.width === to.width && from.height === to.height) return [];
  return [1, 2, 3, 4, 5].map(step => {
    const t = step / 6, eased = t * t * (3 - 2 * t);
    const lerp = (a: number, b: number) => Math.round(a + (b - a) * eased);
    const x = lerp(from.x, to.x), y = lerp(from.y, to.y);
    return { x, y, width: lerp(from.x + from.width, to.x + to.width) - x, height: lerp(from.y + from.height, to.y + to.height) - y };
  });
}
