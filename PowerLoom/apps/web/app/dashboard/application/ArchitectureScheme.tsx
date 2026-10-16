"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import { NODE_HEIGHT, NODE_WIDTH, ancestorsOf, layoutLevel, type PlacedLink, type PlacedNode } from "./schemeLayout";
import type { NodeHealth } from "./schemeHealth";

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const ZOOM_STEP = 1.1;
const MIN_SCALE = 0.4;
const MAX_SCALE = 3;
const PAIR_OFFSET = 7;

// One level of the scheme at a time. The open level lives in the URL (`focus`), so an attention entry and the browser's
// back button open a level too; the breadcrumb goes back up. Wheel zooms around the pointer, dragging pans. `highlight`
// marks one node of the level.
export function ArchitectureScheme({ health, focus, highlight }: { health: Record<string, NodeHealth>; focus: string | null; highlight: string | null }) {
  const router = useRouter();
  const layout = layoutLevel(focus);
  const [view, setView] = useState<ViewBox>({ x: 0, y: 0, w: layout.width, h: layout.height });
  const drag = useRef<{ x: number; y: number; view: ViewBox; moved: boolean } | null>(null);

  useEffect(() => {
    setView({ x: 0, y: 0, w: layout.width, h: layout.height });
  }, [focus, layout.width, layout.height]);

  function open(id: string | null): void {
    router.replace(id ? `/dashboard?tab=application&focus=${id}` : "/dashboard?tab=application", { scroll: false });
  }

  function onWheel(event: WheelEvent<SVGSVGElement>): void {
    const factor = event.deltaY > 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, (layout.width / view.w) / factor));
    const w = layout.width / scale;
    const h = layout.height / scale;
    const point = pointerPosition(event, view);

    setView({ x: point.x - (point.x - view.x) * (w / view.w), y: point.y - (point.y - view.y) * (h / view.h), w, h });
  }

  function onPointerDown(event: PointerEvent<SVGSVGElement>): void {
    drag.current = { x: event.clientX, y: event.clientY, view, moved: false };
  }

  // The pointer is captured only once this is a drag: capturing on the press would send the click to the svg instead
  // of the node under the pointer.
  function onPointerMove(event: PointerEvent<SVGSVGElement>): void {
    if (!drag.current) {
      return;
    }

    const scale = view.w / event.currentTarget.clientWidth;
    const dx = event.clientX - drag.current.x;
    const dy = event.clientY - drag.current.y;

    if (!drag.current.moved && Math.abs(dx) + Math.abs(dy) > 4) {
      drag.current.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    if (drag.current.moved) {
      setView({ ...drag.current.view, x: drag.current.view.x - dx * scale, y: drag.current.view.y - dy * scale });
    }
  }

  // A click that was really a drag doesn't open the node under the pointer.
  function onNodeClick(node: PlacedNode): void {
    if (node.hasChildren && !drag.current?.moved) {
      open(node.node.id);
    }
  }

  function onPointerUp(): void {
    const dragged = drag.current;

    setTimeout(() => (drag.current = drag.current === dragged ? null : drag.current), 0);
  }

  return (
    <div className="scheme">
      <Breadcrumb level={focus} onSelect={open} />
      <svg viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} preserveAspectRatio="xMidYMin meet" onWheel={onWheel} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}>
        <defs>
          <marker id="scheme-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" className="scheme-arrow" />
          </marker>
        </defs>
        {layout.links.map((link) => <Link key={`${link.from.node.id}-${link.to.node.id}`} link={link} paired={layout.links.some((other) => other.from === link.to && other.to === link.from)} />)}
        {layout.nodes.map((placed) => <Node key={placed.node.id} placed={placed} health={health[placed.node.id] ?? "off"} marked={placed.node.id === highlight} onClick={onNodeClick} />)}
      </svg>
      <p className="muted">Click a module to open it, scroll to zoom, drag to move. Colors: PowerLoom&apos;s status; a parent shows the worst of its parts.</p>
    </div>
  );
}

function Breadcrumb({ level, onSelect }: { level: string | null; onSelect: (id: string | null) => void }) {
  const chain = ancestorsOf(level);

  return (
    <nav className="scheme-breadcrumb">
      <button type="button" className="link-button" onClick={() => onSelect(null)} disabled={level === null}>System</button>
      {chain.map((node) => (
        <span key={node.id}> › <button type="button" className="link-button" onClick={() => onSelect(node.id)} disabled={node.id === level}>{node.label}</button></span>
      ))}
    </nav>
  );
}

function Node({ placed, health, marked, onClick }: { placed: PlacedNode; health: NodeHealth; marked: boolean; onClick: (placed: PlacedNode) => void }) {
  const { node, x, y, hasChildren } = placed;
  const classes = ["scheme-node", `kind-${node.kind}`, `health-${health}`, marked ? "marked" : "", hasChildren ? "openable" : ""].filter(Boolean).join(" ");

  return (
    <g className={classes} transform={`translate(${x} ${y})`} onClick={() => onClick(placed)}>
      <title>{node.detail ? `${node.label}: ${node.detail}` : node.label}</title>
      <rect width={NODE_WIDTH} height={NODE_HEIGHT} rx={8} />
      <circle className="scheme-dot" cx={14} cy={14} r={5} />
      <text x={26} y={19} className="scheme-label">{node.label}</text>
      {node.detail && <text x={12} y={41} className="scheme-detail">{clip(node.detail, 30)}</text>}
      {hasChildren && <text x={NODE_WIDTH - 14} y={19} className="scheme-more">+</text>}
    </g>
  );
}

// Two links between the same nodes (a request and its callback) run side by side instead of on top of each other.
function Link({ link, paired }: { link: PlacedLink; paired: boolean }) {
  const from = center(link.from);
  const to = center(link.to);
  const offset = paired ? perpendicular(from, to, PAIR_OFFSET) : { x: 0, y: 0 };
  const start = shift(edgePoint(from, to), offset);
  const end = shift(edgePoint(to, from), offset);
  const labelShift = paired ? perpendicular(from, to, PAIR_OFFSET + 6) : { x: 0, y: -4 };
  const labelAt = { x: (start.x + end.x) / 2 + labelShift.x, y: (start.y + end.y) / 2 + labelShift.y };
  // Beside a steep pair the labels run along the lines, so they fit between the pair and the nodes beside it.
  const angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
  const upright = angle > 90 ? angle - 180 : angle < -90 ? angle + 180 : angle;
  const rotate = paired && Math.abs(upright) > 45 ? `rotate(${upright} ${labelAt.x} ${labelAt.y})` : undefined;

  return (
    <g className="scheme-link">
      <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} markerEnd="url(#scheme-arrow)" />
      {link.label && <text x={labelAt.x} y={labelAt.y} className="scheme-link-label" dominantBaseline={rotate ? "central" : undefined} transform={rotate}>{link.label}</text>}
    </g>
  );
}

function center(placed: PlacedNode): { x: number; y: number } {
  return { x: placed.x + NODE_WIDTH / 2, y: placed.y + NODE_HEIGHT / 2 };
}

// Where a line from `a` towards `b` leaves `a`'s box.
function edgePoint(a: { x: number; y: number }, b: { x: number; y: number }): { x: number; y: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const scale = Math.min(NODE_WIDTH / 2 / Math.max(Math.abs(dx), 1), NODE_HEIGHT / 2 / Math.max(Math.abs(dy), 1));

  return { x: a.x + dx * scale, y: a.y + dy * scale };
}

// A vector of `length` at a right angle to a → b, to the right of the direction of travel.
function perpendicular(a: { x: number; y: number }, b: { x: number; y: number }, length: number): { x: number; y: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const size = Math.max(Math.hypot(dx, dy), 1);

  return { x: (dy / size) * length, y: (-dx / size) * length };
}

function shift(point: { x: number; y: number }, by: { x: number; y: number }): { x: number; y: number } {
  return { x: point.x + by.x, y: point.y + by.y };
}

function pointerPosition(event: WheelEvent<SVGSVGElement>, view: ViewBox): { x: number; y: number } {
  const box = event.currentTarget.getBoundingClientRect();

  return { x: view.x + ((event.clientX - box.left) / box.width) * view.w, y: view.y + ((event.clientY - box.top) / box.height) * view.h };
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
