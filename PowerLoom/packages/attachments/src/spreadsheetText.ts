import readXlsxFile, { type Row, type Sheet } from "read-excel-file/node";

// An Excel workbook as agents read it: each non-empty sheet is a "## <name>" section of CSV rows, compact and with every
// cell kept.
export async function readXlsx(bytes: Buffer): Promise<string> {
  const sheets = await readXlsxFile(bytes);

  return sheets.filter((sheet) => sheet.data.length > 0).map(sheetText).join("\n\n");
}

function sheetText(sheet: Sheet): string {
  return [`## ${sheet.sheet}`, ...sheet.data.map(csvRow)].join("\n");
}

function csvRow(row: Row): string {
  return row.map(csvCell).join(",");
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : value instanceof Date ? value.toISOString() : String(value);

  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
