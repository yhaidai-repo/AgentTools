// One long value (a JSON blob, a note) can't crowd out the other rows.
const MAX_CELL_CHARS = 300;
const MAX_BINARY_BYTES = 32;

// Rows as a Markdown table, the form agents read best.
export function toMarkdownTable(columns: string[], rows: unknown[][]): string {
  const header = `| ${columns.map(cellText).join(" | ")} |`;
  const divider = `|${columns.map(() => " --- ").join("|")}|`;
  const body = rows.map((row) => `| ${row.map(cellText).join(" | ")} |`);

  return [header, divider, ...body].join("\n");
}

function cellText(value: unknown): string {
  const text = valueText(value).replace(/\r?\n/g, " ").replace(/\|/g, "\\|");

  return text.length > MAX_CELL_CHARS ? `${text.slice(0, MAX_CELL_CHARS)}…` : text;
}

function valueText(value: unknown): string {
  if (value === null || value === undefined) {
    return "NULL";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Buffer.isBuffer(value)) {
    return binaryText(value);
  }

  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function binaryText(value: Buffer): string {
  const shown = value.subarray(0, MAX_BINARY_BYTES).toString("hex").toUpperCase();

  return `0x${shown}${value.length > MAX_BINARY_BYTES ? `… (${value.length} bytes)` : ""}`;
}
