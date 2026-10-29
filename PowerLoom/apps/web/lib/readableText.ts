import { pbiMentionHref, PBI_MENTION_SOURCE } from "./pbiMentions";

// Agent-written text as markdown a page can show (user report 2026-10-25: human tasks with unreadable descriptions).
// A model that escaped its line breaks twice sends a literal "\n" and no real one: those become line breaks. Every
// PBI mention outside code links to its PBI's page or, with a kind (PBI-1:plan), to its latest result of that kind, as
// PbiLinkedText does for plain text.
export function readableMarkdown(text: string): string {
  return linkPbiMentions(unescapedLineBreaks(text));
}

function unescapedLineBreaks(text: string): string {
  return text.includes("\n") ? text : text.replace(/\\r\\n|\\n/g, "\n").replace(/\\t/g, "  ");
}

// Code (fenced or inline) is left alone; [PBI-1](…) already is a link.
const CODE = /(```[\s\S]*?```|`[^`\n]*`)/;
const PBI_MENTION = new RegExp(`(?<!\\[)${PBI_MENTION_SOURCE}(?!\\])`, "g");

function linkPbiMentions(text: string): string {
  return text.split(CODE).map((part, index) => (index % 2 === 1 ? part : linkMentionsOutsideCode(part))).join("");
}

function linkMentionsOutsideCode(text: string): string {
  return text.replace(PBI_MENTION, (mention, id: string, kind: string | undefined) => `[${mention}](${pbiMentionHref(id, kind)})`);
}
