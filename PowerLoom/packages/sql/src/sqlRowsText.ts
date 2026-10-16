import { toMarkdownTable } from "./markdownTable";
import type { SqlRows } from "./models/SqlRows";
import type { SqlRowsText } from "./models/SqlRowsText";

// An answer's text is cut here so one wide result can't fill the reader's context (as for Confluence pages).
const MAX_ANSWER_CHARS = 60_000;

export function sqlRowsText({ columns, rows, truncated, moreResultSets }: SqlRows): SqlRowsText {
  const notes = [truncated ? "[first 200 rows only: narrow the query]" : "", moreResultSets > 0 ? `[${moreResultSets} more result set(s) not shown: one SELECT per query]` : ""].filter(Boolean);
  const text = [`${rows.length} row(s)`, toMarkdownTable(columns, rows), ...notes].join("\n\n");
  const cut = text.length > MAX_ANSWER_CHARS ? `\n\n[cut at ${MAX_ANSWER_CHARS} of ${text.length} characters: select fewer columns or rows]` : "";

  return { text: `${text.slice(0, MAX_ANSWER_CHARS)}${cut}`, rows: rows.length, truncated: truncated || cut.length > 0 };
}
