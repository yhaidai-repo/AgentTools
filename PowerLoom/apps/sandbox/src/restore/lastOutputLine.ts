const MAX_LINE_CHARS = 200;

/** The last line of `text` that says something, cut short; null when there is none. */
export function lastOutputLine(text: string): string | null {
  const line = text.split(/\r?\n/).map((candidate) => candidate.trim()).filter(Boolean).at(-1);

  if (line === undefined) {
    return null;
  }

  return line.length > MAX_LINE_CHARS ? `${line.slice(0, MAX_LINE_CHARS)}…` : line;
}
