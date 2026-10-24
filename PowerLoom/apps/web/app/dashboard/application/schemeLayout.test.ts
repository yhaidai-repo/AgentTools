import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SCHEME_NODES } from "./architecture";
import { NODE_HEIGHT, NODE_WIDTH, layoutLevel, type PlacedNode } from "./schemeLayout";

// The hand-placed levels: "no two links cross and no link runs through a node" (architecture.ts).
const HAND_PLACED = [null, "powerloom", "agent-runner", "web"];
// Lines are drawn centre to centre; a few pixels of slack keep a line that grazes a corner from counting.
const MARGIN = 4;

interface Point {
  x: number;
  y: number;
}

function centre(node: PlacedNode): Point {
  return { x: node.x + NODE_WIDTH / 2, y: node.y + NODE_HEIGHT / 2 };
}

function overlaps(a: PlacedNode, b: PlacedNode): boolean {
  return a.x < b.x + NODE_WIDTH && b.x < a.x + NODE_WIDTH && a.y < b.y + NODE_HEIGHT && b.y < a.y + NODE_HEIGHT;
}

// Liang-Barsky: whether the segment enters the node's box (shrunk by the margin).
function runsThrough(from: Point, to: Point, node: PlacedNode): boolean {
  const box = { left: node.x + MARGIN, right: node.x + NODE_WIDTH - MARGIN, top: node.y + MARGIN, bottom: node.y + NODE_HEIGHT - MARGIN };
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const edges = [[-dx, from.x - box.left], [dx, box.right - from.x], [-dy, from.y - box.top], [dy, box.bottom - from.y]];
  let enter = 0;
  let leave = 1;

  for (const [p, q] of edges) {
    if (p === 0 && q < 0) {
      return false;
    }

    if (p !== 0) {
      const t = q / p;

      enter = p < 0 ? Math.max(enter, t) : enter;
      leave = p > 0 ? Math.min(leave, t) : leave;
    }
  }

  return enter < leave;
}

// Whether two segments that share no end cross (strictly: touching ends don't count).
function crosses(a: Point, b: Point, c: Point, d: Point): boolean {
  const side = (p: Point, q: Point, r: Point) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));

  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
}

describe("the architecture scheme's hand-placed levels", () => {
  for (const level of HAND_PLACED) {
    const layout = layoutLevel(level);

    it(`${level ?? "top level"}: no two nodes overlap`, () => {
      const clashes = layout.nodes.flatMap((a, index) => layout.nodes.slice(index + 1).filter((b) => overlaps(a, b)).map((b) => `${a.node.id} / ${b.node.id}`));

      assert.deepEqual(clashes, []);
    });

    it(`${level ?? "top level"}: no link runs through a node it doesn't connect`, () => {
      const through = layout.links.flatMap((link) => layout.nodes.filter((node) => node !== link.from && node !== link.to && runsThrough(centre(link.from), centre(link.to), node)).map((node) => `${link.from.node.id} → ${link.to.node.id} through ${node.node.id}`));

      assert.deepEqual(through, []);
    });

    it(`${level ?? "top level"}: no two links cross`, () => {
      const links = layout.links;
      const crossings = links.flatMap((a, index) => links.slice(index + 1)
        .filter((b) => ![b.from, b.to].includes(a.from) && ![b.from, b.to].includes(a.to))
        .filter((b) => crosses(centre(a.from), centre(a.to), centre(b.from), centre(b.to)))
        .map((b) => `${a.from.node.id} → ${a.to.node.id} × ${b.from.node.id} → ${b.to.node.id}`));

      assert.deepEqual(crossings, []);
    });
  }

  it("has unique node ids and links only between nodes that exist", async () => {
    const { SCHEME_LINKS } = await import("./architecture");
    const ids = SCHEME_NODES.map((node) => node.id);

    assert.equal(new Set(ids).size, ids.length);
    assert.deepEqual(SCHEME_LINKS.filter((link) => !ids.includes(link.from) || !ids.includes(link.to)), []);
  });
});
