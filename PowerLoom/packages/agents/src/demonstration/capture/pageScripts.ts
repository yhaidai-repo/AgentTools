import type { PixelBox } from "../media/models/PixelBox";

// Always masked, whatever the task lists: a password field may show its value (reveal buttons, autofill previews).
export const ALWAYS_MASKED = ["input[type=password]"];
const MASK_PADDING = 2;

/** browser_evaluate source: the boxes of the selectors' visible elements, in CSS pixels of the page (viewport + scroll). */
export function maskBoxesScript(selectors: string[]): string {
  return `() => {
    const boxes = [];
    for (const selector of ${JSON.stringify(selectors)}) {
      let nodes = [];
      try { nodes = Array.from(document.querySelectorAll(selector)); } catch (error) { return { error: "Invalid selector: " + selector }; }
      for (const node of nodes) {
        const r = node.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) boxes.push([r.x, r.y, r.width, r.height]);
      }
    }
    return { boxes, scrollX: window.scrollX, scrollY: window.scrollY, page: location.origin + location.pathname };
  }`;
}

/** browser_evaluate source run on an element: its centre in the viewport, where the drawn pointer goes. */
export const POINTER_SCRIPT = "(element) => { const r = element.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }";

/** The object a browser_evaluate result prints, or null when its text holds none. */
export function evaluatedObject(text: string): Record<string, unknown> | null {
  const section = text.split(/^### /m).find((part) => part.startsWith("Result")) ?? text;
  const start = section.indexOf("{");
  const end = section.lastIndexOf("}");

  if (start < 0 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(section.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** The masks in image pixels: padded outwards, clipped to the image; scroll is added for a full-page capture. */
export function maskBoxes(result: Record<string, unknown>, fullPage: boolean, width: number, height: number): PixelBox[] {
  const boxes = Array.isArray(result.boxes) ? result.boxes as number[][] : [];
  const offsetX = fullPage ? Number(result.scrollX ?? 0) : 0;
  const offsetY = fullPage ? Number(result.scrollY ?? 0) : 0;

  return boxes.map(([x, y, w, h]) => clip(x + offsetX, y + offsetY, w, h, width, height)).filter((box): box is PixelBox => box !== null);
}

function clip(x: number, y: number, w: number, h: number, width: number, height: number): PixelBox | null {
  const left = Math.max(0, Math.floor(x) - MASK_PADDING);
  const top = Math.max(0, Math.floor(y) - MASK_PADDING);
  const right = Math.min(width, Math.ceil(x + w) + MASK_PADDING);
  const bottom = Math.min(height, Math.ceil(y + h) + MASK_PADDING);

  if (right <= left || bottom <= top) {
    return null;
  }

  return { x: left, y: top, width: right - left, height: bottom - top };
}
