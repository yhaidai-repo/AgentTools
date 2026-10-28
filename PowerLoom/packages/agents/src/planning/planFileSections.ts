import type { PlanRisk } from "@powerloom/db";

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;
const INLINE_LIST = /^requirements:\s*\[(.*)\]\s*$/m;
const BLOCK_LIST = /^requirements:\s*\r?\n((?:[ \t]+-[^\n]*\r?\n?)+)/m;
const BULLET = /^\s*-\s+(.+)$/;
const FLAGGED_HEADING = /^## Flagged Assumptions[^\n]*$/m;
const NEXT_BLOCK = /^(?:## |<)/m;
// The STRIDE register's columns as GSD's planner writes them; a row is matched to them by header name, not position.
const RISK_COLUMNS: Record<keyof Omit<PlanRisk, "plan">, string> = {
  id: "threat id",
  category: "category",
  component: "component",
  severity: "severity",
  disposition: "disposition",
  mitigation: "mitigation plan",
};

// The requirement ids a plan's frontmatter lists (`requirements: [A, B]` or a YAML block list).
export function frontmatterRequirements(plan: string): string[] {
  const frontmatter = FRONTMATTER.exec(plan)?.[1] ?? "";
  const inline = INLINE_LIST.exec(frontmatter);

  if (inline) {
    return inline[1].split(",").map(unquoted).filter(Boolean);
  }

  return bullets(BLOCK_LIST.exec(frontmatter)?.[1] ?? "").map(unquoted);
}

// The text between <tag> and </tag>, or "" when the file has no such block.
export function taggedSection(text: string, tag: string): string {
  const start = text.indexOf(`<${tag}>`);
  const end = text.indexOf(`</${tag}>`, start);

  return start < 0 || end < 0 ? "" : text.slice(start + tag.length + 2, end);
}

// The top-level bullets of a block, one line each.
export function bullets(block: string): string[] {
  return block.split(/\r?\n/).map((line) => BULLET.exec(line)?.[1]?.trim() ?? "").filter(Boolean);
}

// The bullets under "## Flagged Assumptions": what the planner assumed without a spec to check it against.
export function flaggedAssumptions(plan: string): string[] {
  const heading = FLAGGED_HEADING.exec(plan);

  if (!heading) {
    return [];
  }

  const rest = plan.slice(heading.index + heading[0].length);
  const next = NEXT_BLOCK.exec(rest);

  return bullets(next ? rest.slice(0, next.index) : rest);
}

// The rows of the STRIDE threat register in a plan's <threat_model>.
export function threatRegister(plan: string, planId: string): PlanRisk[] {
  const rows = tableRows(taggedSection(plan, "threat_model"));
  const headerIndex = rows.findIndex((cells) => cells.some((cell) => cell.toLowerCase() === RISK_COLUMNS.id));

  if (headerIndex < 0) {
    return [];
  }

  const header = rows[headerIndex].map((cell) => cell.toLowerCase());

  return rows.slice(headerIndex + 1).filter((cells) => !isDivider(cells)).map((cells) => riskOf(header, cells, planId));
}

function riskOf(header: string[], cells: string[], planId: string): PlanRisk {
  const cell = (column: string) => cells[header.indexOf(column)] ?? "";

  return {
    id: cell(RISK_COLUMNS.id),
    plan: planId,
    category: cell(RISK_COLUMNS.category),
    component: cell(RISK_COLUMNS.component),
    severity: cell(RISK_COLUMNS.severity),
    disposition: cell(RISK_COLUMNS.disposition),
    mitigation: cell(RISK_COLUMNS.mitigation),
  };
}

// Consecutive markdown table lines; a register is the table whose header names the threat id.
function tableRows(block: string): string[][] {
  return block.split(/\r?\n/).filter((line) => line.trim().startsWith("|")).map(cellsOf);
}

function cellsOf(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map((cell) => cell.trim());
}

function isDivider(cells: string[]): boolean {
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function unquoted(value: string): string {
  return value.trim().replace(/^["']|["']$/g, "");
}
