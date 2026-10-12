import { SCHEME_LINKS, SCHEME_NODES, type SchemeNode } from "./architecture";

export const NODE_WIDTH = 170;
export const NODE_HEIGHT = 58;
const GAP_X = 60;
const GAP_Y = 44;

export interface PlacedNode {
  node: SchemeNode;
  x: number;
  y: number;
  hasChildren: boolean;
}

export interface PlacedLink {
  from: PlacedNode;
  to: PlacedNode;
  label?: string;
}

export interface Layout {
  nodes: PlacedNode[];
  links: PlacedLink[];
  width: number;
  height: number;
}

export function childrenOf(parent: string | null): SchemeNode[] {
  return SCHEME_NODES.filter((node) => (node.parent ?? null) === parent);
}

export function nodeById(id: string): SchemeNode | undefined {
  return SCHEME_NODES.find((node) => node.id === id);
}

// The nodes the breadcrumb lists: the focused node and its ancestors, top first.
export function ancestorsOf(id: string | null): SchemeNode[] {
  const chain: SchemeNode[] = [];

  for (let current = id ? nodeById(id) : undefined; current; current = current.parent ? nodeById(current.parent) : undefined) {
    chain.unshift(current);
  }

  return chain;
}

// One level: the focused node's children on the grid (hand placed, or in rows), and the links between them. A link
// whose end lies deeper is drawn to the visible ancestor; a link to a node outside this level is left out.
export function layoutLevel(focus: string | null): Layout {
  const nodes = placeNodes(childrenOf(focus));
  const visible = new Map(nodes.map((placed) => [placed.node.id, placed]));
  const links = SCHEME_LINKS.flatMap((link) => placeLink(link.from, link.to, link.label, visible))
    .filter((link, index, all) => all.findIndex((other) => other.from === link.from && other.to === link.to) === index);
  const width = Math.max(...nodes.map((placed) => placed.x + NODE_WIDTH), NODE_WIDTH) + GAP_X;
  const height = Math.max(...nodes.map((placed) => placed.y + NODE_HEIGHT), NODE_HEIGHT) + GAP_Y;

  return { nodes, links, width, height };
}

function placeNodes(nodes: SchemeNode[]): PlacedNode[] {
  const columns = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
  const placed = nodes.map((node, index) => {
    const column = node.x ?? index % columns;
    const row = node.y ?? Math.floor(index / columns);

    return { node, x: GAP_X / 2 + column * (NODE_WIDTH + GAP_X), y: GAP_Y / 2 + row * (NODE_HEIGHT + GAP_Y), hasChildren: childrenOf(node.id).length > 0 };
  });

  return placed;
}

// A link between two visible nodes, or none when an end lies outside this level or both ends map to one node.
function placeLink(fromId: string, toId: string, label: string | undefined, visible: Map<string, PlacedNode>): PlacedLink[] {
  const from = visibleAncestor(fromId, visible);
  const to = visibleAncestor(toId, visible);

  return from && to && from !== to ? [{ from, to, label }] : [];
}

function visibleAncestor(id: string, visible: Map<string, PlacedNode>): PlacedNode | undefined {
  for (let current = nodeById(id); current; current = current.parent ? nodeById(current.parent) : undefined) {
    const placed = visible.get(current.id);

    if (placed) {
      return placed;
    }
  }

  return undefined;
}
