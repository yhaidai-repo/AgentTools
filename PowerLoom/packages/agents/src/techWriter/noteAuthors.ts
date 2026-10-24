import type { NoteAuthor } from "./models/NoteAuthor";

const FENCE = "---";
const AUTHORS_KEY = /^authors:\s*(.*)$/;
const LIST_ITEM = /^\s+-\s+(.+)$/;

// Stamps the writer into the note's `authors` (the vault rule: one entry per writer, its latest change). Entries of the
// note as it is on disk are kept, even when the agent's version dropped them.
export function withAuthor(content: string, previous: string | null, author: NoteAuthor): string {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const end = frontmatterEnd(lines);

  if (end < 0) {
    return content;
  }

  const entries = mergeAuthors([...authorsOf(previous), ...authorsOf(content)], author);

  return [...lines.slice(0, 1), ...withoutAuthors(lines.slice(1, end)), `authors: [${entries.map((entry) => JSON.stringify(entry)).join(", ")}]`, ...lines.slice(end)].join("\n");
}

export function hasFrontmatter(content: string): boolean {
  return frontmatterEnd(content.split("\n")) > 0;
}

function mergeAuthors(entries: string[], author: NoteAuthor): string[] {
  const others = [...new Set(entries)].filter((entry) => writerOf(entry) !== author.writer);

  return [...others, `${author.writer} (${author.context}, ${author.date})`];
}

function writerOf(entry: string): string {
  return entry.split(" (")[0].trim();
}

function authorsOf(content: string | null): string[] {
  const lines = (content ?? "").split("\n").map((line) => line.replace(/\r$/, ""));
  const end = frontmatterEnd(lines);
  const start = lines.findIndex((line, index) => index < end && AUTHORS_KEY.test(line));

  if (start < 0) {
    return [];
  }

  const inline = lines[start].match(AUTHORS_KEY)?.[1].trim() ?? "";

  return inline ? inlineEntries(inline) : listEntries(lines.slice(start + 1, end));
}

// `authors: ["a", "b"]` or `authors: [a, b]`.
function inlineEntries(value: string): string[] {
  const quoted = [...value.matchAll(/"([^"]*)"/g)].map((match) => match[1]);

  return quoted.length > 0 ? quoted : value.replace(/^\[|\]$/g, "").split(",").map((entry) => entry.trim()).filter(Boolean);
}

// The block form: `authors:` followed by `  - entry` lines.
function listEntries(following: string[]): string[] {
  const items = following.slice(0, firstNonItem(following));

  return items.map((line) => (line.match(LIST_ITEM)?.[1] ?? "").replace(/^"|"$/g, "").trim()).filter(Boolean);
}

function withoutAuthors(frontmatter: string[]): string[] {
  const start = frontmatter.findIndex((line) => AUTHORS_KEY.test(line));

  if (start < 0) {
    return frontmatter;
  }

  const blockLength = 1 + firstNonItem(frontmatter.slice(start + 1));

  return [...frontmatter.slice(0, start), ...frontmatter.slice(start + blockLength)];
}

function firstNonItem(lines: string[]): number {
  const index = lines.findIndex((line) => !LIST_ITEM.test(line));

  return index < 0 ? lines.length : index;
}

// Index of the closing fence, or -1 when the note doesn't open with frontmatter.
function frontmatterEnd(lines: string[]): number {
  if (lines[0]?.trim() !== FENCE) {
    return -1;
  }

  return lines.findIndex((line, index) => index > 0 && line.trim() === FENCE);
}
