import type { BuildDeviation, VerificationTruth } from "@powerloom/db";
import { bullets, isDivider, tableRows } from "../planning/planFileSections";

const ONE_LINER = /^\*\*(.+)\*\*\s*$/m;
const DEVIATION_ENTRY = /^\*\*\d+\.\s*(.+?)\*\*\s*$/;
const NO_DEVIATIONS = /^\s*none\b/i;
const TRUTH_COLUMNS = { truth: "truth", status: "status", evidence: "evidence" };

// The text under a markdown heading (`## Deviations from Plan`) up to the next heading of the same or a higher level;
// "" when the file has no such heading.
export function headedSection(text: string, heading: string): string {
  const level = /^#+/.exec(heading)?.[0].length ?? 2;
  const nextHeading = new RegExp(`^#{1,${level}} `);
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === heading);

  if (start < 0) {
    return "";
  }

  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => nextHeading.test(line));

  return (end < 0 ? rest : rest.slice(0, end)).join("\n");
}

// A SUMMARY.md's one-liner: the bold line under its title, what the plan delivered.
export function summaryOneLiner(summary: string): string {
  const body = summary.replace(/^---\r?\n[\s\S]*?\r?\n---/, "");

  return ONE_LINER.exec(body)?.[1]?.trim() ?? "";
}

// The deviations a SUMMARY.md records ("## Deviations from Plan"): each auto-fix entry's title, or the section's
// bullets; none when it says "None".
export function summaryDeviations(summary: string, plan: string): BuildDeviation[] {
  const section = headedSection(summary, "## Deviations from Plan").trim();

  if (section === "" || NO_DEVIATIONS.test(section)) {
    return [];
  }

  const entries = section.split(/\r?\n/).map((line) => DEVIATION_ENTRY.exec(line.trim())?.[1]?.trim() ?? "").filter(Boolean);
  const texts = entries.length > 0 ? entries : bullets(section);

  return texts.map((text) => ({ plan, text }));
}

// The rows of a VERIFICATION.md's Observable Truths table, matched to its columns by header name.
export function verificationTruths(verification: string): VerificationTruth[] {
  const rows = tableRows(headedSection(verification, "### Observable Truths"));
  const header = rows[0]?.map((cell) => cell.toLowerCase()) ?? [];

  if (!header.includes(TRUTH_COLUMNS.truth)) {
    return [];
  }

  return rows.slice(1).filter((cells) => !isDivider(cells)).map((cells) => truthOf(header, cells));
}

function truthOf(header: string[], cells: string[]): VerificationTruth {
  const cell = (column: string) => cells[header.indexOf(column)] ?? "";

  return { truth: cell(TRUTH_COLUMNS.truth), status: cell(TRUTH_COLUMNS.status), evidence: cell(TRUTH_COLUMNS.evidence) };
}
