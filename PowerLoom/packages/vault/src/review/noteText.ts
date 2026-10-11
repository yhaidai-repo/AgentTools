const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;

// The frontmatter's lines without the fences; empty when the note has none.
export function frontmatterBlock(text: string): string {
  return FRONTMATTER.exec(text)?.[1] ?? "";
}

// The frontmatter `title`, else the first `# heading`; null when the note has neither.
export function noteTitle(text: string): string | null {
  const title = /^title:\s*(.+?)\s*$/m.exec(frontmatterBlock(text))?.[1];

  return title ? unquoted(title) : (/^# (.+)$/m.exec(text)?.[1] ?? null);
}

// Sets one frontmatter field (e.g. `status: needs-review`), replacing its line or adding it before the closing fence.
// A note without frontmatter is returned as it is.
export function withFrontmatterField(text: string, key: string, value: string): string {
  const match = FRONTMATTER.exec(text);

  if (!match) {
    return text;
  }

  const field = new RegExp(`^${key}:.*$`, "m");
  const block = field.test(match[1]) ? match[1].replace(field, `${key}: ${value}`) : `${match[1]}\n${key}: ${value}`;

  return text.replace(match[1], block);
}

// YAML quotes wrap the whole value; a title that only ends with a quote mark (`Rule "Active Hospice…"`) keeps it.
function unquoted(value: string): string {
  const isQuoted = value.length > 1 && /^(["']).*\1$/.test(value);

  return isQuoted ? value.slice(1, -1) : value;
}
