// How strictly a hunk's lines must match, tried in this order (as Codex's own apply_patch does): models often get
// trailing spaces, indentation or typographic quotes slightly wrong.
const COMPARERS: ((line: string) => string)[] = [
  (line) => line,
  (line) => line.trimEnd(),
  (line) => line.trim(),
  (line) => normalizePunctuation(line.trim()),
];

/** The first index at or after `from` where `wanted` occurs in `lines`, or -1. `atEnd`: the match must end the file. */
export function seekLines(lines: string[], wanted: string[], from: number, atEnd: boolean): number {
  if (wanted.length === 0) {
    return from;
  }

  for (const compare of COMPARERS) {
    const index = atEnd ? matchAtEnd(lines, wanted, from, compare) : firstMatch(lines, wanted, from, compare);

    if (index >= 0) {
      return index;
    }
  }

  return -1;
}

function firstMatch(lines: string[], wanted: string[], from: number, compare: (line: string) => string): number {
  for (let start = from; start + wanted.length <= lines.length; start++) {
    if (matchesAt(lines, wanted, start, compare)) {
      return start;
    }
  }

  return -1;
}

function matchAtEnd(lines: string[], wanted: string[], from: number, compare: (line: string) => string): number {
  const start = lines.length - wanted.length;

  return start >= from && matchesAt(lines, wanted, start, compare) ? start : -1;
}

function matchesAt(lines: string[], wanted: string[], start: number, compare: (line: string) => string): boolean {
  return wanted.every((line, offset) => compare(lines[start + offset]) === compare(line));
}

function normalizePunctuation(line: string): string {
  return line
    .replace(/[‐-―−]/g, "-")
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, "\"")
    .replace(/[  -   　]/g, " ");
}
