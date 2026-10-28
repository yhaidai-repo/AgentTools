import type { EditApplied } from "@powerloom/sandbox";
import type { Outcome } from "../models/Outcome";

// Claude Code's Edit rule: the old text must occur exactly once unless every match is replaced. A file with CRLF line
// endings still matches old text sent with LF (models send LF), and the replacement gets the file's own endings.
export function editText(content: string, oldString: string, newString: string, replaceAll: boolean): Outcome<{ content: string; applied: EditApplied }> {
  if (oldString.length === 0) {
    return { ok: false, reason: "old_string is empty: use write_file to write a whole file" };
  }

  if (oldString === newString) {
    return { ok: false, reason: "old_string and new_string are the same: nothing to change" };
  }

  const [wanted, replacement] = inFileEndings(content, oldString, newString);
  const count = countOf(content, wanted);

  if (count === 0) {
    return { ok: false, reason: "old_string was not found: it must be the file's text as it is now, with its exact indentation (read the file again)" };
  }

  if (count > 1 && !replaceAll) {
    return { ok: false, reason: `old_string was found ${count} times: add surrounding lines so it matches once, or set replace_all` };
  }

  const first = content.indexOf(wanted);
  const edited = replaceAll ? content.split(wanted).join(replacement) : content.slice(0, first) + replacement + content.slice(first + wanted.length);
  const fromLine = lineAt(content, first);

  return { ok: true, value: { content: edited, applied: { count, lines: [fromLine, fromLine + lineCount(replacement) - 1] } } };
}

function inFileEndings(content: string, oldString: string, newString: string): [string, string] {
  const isCrlfFile = content.includes("\r\n");

  if (!isCrlfFile || content.includes(oldString)) {
    return [oldString, newString];
  }

  return [toCrlf(oldString), toCrlf(newString)];
}

function toCrlf(text: string): string {
  return text.replace(/\r?\n/g, "\r\n");
}

function countOf(content: string, wanted: string): number {
  return content.split(wanted).length - 1;
}

function lineAt(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

function lineCount(text: string): number {
  return Math.max(1, text.split("\n").length);
}
