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
