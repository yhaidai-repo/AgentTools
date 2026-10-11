import type { WikiLink } from "../models/WikiLink";

// [[name]], [[name|label]], [[name#heading]], ![[embed]]; groups: embed mark, target, #heading, |label.
const LINK = /(!?)\[\[([^\]|#]*)(#[^\]|]*)?(\|[^\]]*)?\]\]/g;
const FENCE = /^\s*(```|~~~)/;
// The capture group keeps the code spans in split()'s result, at the odd indexes.
const INLINE_CODE = /(`[^`]*`)/;

// Links in fenced code and inline code are examples (e.g. AGENTS.md's templates), not links.
export function parseWikiLinks(from: string, content: string): WikiLink[] {
  const lines = content.split("\n");
  const links: WikiLink[] = [];

  mapProse(content, (segment, line) => {
    links.push(...linksIn(segment).map((match) => toLink(from, match, line, lines[line - 1])));

    return segment;
  });

  return links;
}

// Repoints every link to `target` at `to`, or turns it into plain text (its label, else its target) when `to` is null.
// A repointed link keeps its label and drops its heading, which the new note may not have (assumption).
export function replaceWikiLinks(content: string, target: string, to: string | null): string {
  const key = linkKey(target);

  return mapProse(content, (segment) => segment.replace(LINK, (whole, embed: string, linked: string, _heading: string | undefined, label: string | undefined) => {
    if (linkKey(linked) !== key) {
      return whole;
    }

    const text = label?.slice(1) ?? null;

    return to === null ? (text ?? linked.trim()) : `${embed}[[${to}${text ? `|${text}` : ""}]]`;
  }));
}

// A closed record's heading gets `[RESOLVED]`, so links to it (`[[register#KI-004]]`) break; the vault rules point them
// at the note instead: `[[register]] (KI-004, resolved)`. In the frontmatter (`related`) the link alone stays, so the
// value is still a link. `registerPath` is the register's path in the vault.
export function withRecordLinksResolved(content: string, registerPath: string, recordId: string): string {
  const keys = [linkKey(registerPath), linkKey(registerPath.split("/").pop()!)];
  const recordHeading = new RegExp(`^(\\[RESOLVED\\] )?${recordId}\\b`);
  const frontmatterLines = frontmatterLineCount(content);

  return mapProse(content, (segment, line) => segment.replace(LINK, (whole, embed: string, linked: string, heading: string | undefined, label: string | undefined) => {
    if (!keys.includes(linkKey(linked)) || !recordHeading.test(heading?.slice(1).trim() ?? "")) {
      return whole;
    }

    const link = `${embed}[[${linked}${label ?? ""}]]`;

    return line <= frontmatterLines ? link : `${link} (${recordId}, resolved)`;
  }));
}

// Lines up to the closing `---`; 0 when the note has no frontmatter.
function frontmatterLineCount(content: string): number {
  const lines = content.split("\n");

  if (lines[0]?.trim() !== "---") {
    return 0;
  }

  return lines.findIndex((line, index) => index > 0 && line.trim() === "---") + 1;
}

// How Obsidian compares link targets: case-insensitive, `.md` optional, `/` separators.
export function linkKey(target: string): string {
  return target.trim().replaceAll("\\", "/").replace(/\.md$/i, "").toLowerCase();
}

function linksIn(segment: string): RegExpMatchArray[] {
  return [...segment.matchAll(LINK)].filter((match) => match[2].trim() !== "");
}

function toLink(from: string, match: RegExpMatchArray, line: number, lineText: string): WikiLink {
  return {
    from,
    target: match[2].trim(),
    heading: match[3]?.slice(1) ?? null,
    label: match[4]?.slice(1) ?? null,
    line,
    text: lineText.trim().slice(0, 300),
  };
}

// Calls `onProse` for each part of a line outside fenced code and inline code, and puts its result in place.
function mapProse(content: string, onProse: (segment: string, line: number) => string): string {
  let inFence = false;

  return content.split("\n").map((line, index) => {
    if (FENCE.test(line)) {
      inFence = !inFence;

      return line;
    }

    return inFence ? line : mapOutsideInlineCode(line, (segment) => onProse(segment, index + 1));
  }).join("\n");
}

function mapOutsideInlineCode(line: string, map: (segment: string) => string): string {
  return line.split(INLINE_CODE).map((part, index) => (index % 2 === 0 ? map(part) : part)).join("");
}
