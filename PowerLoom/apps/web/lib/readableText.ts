// Agent-written text as markdown a page can show (user report 2026-10-25: human tasks with unreadable descriptions).
// A model that escaped its line breaks twice sends a literal "\n" and no real one: those become line breaks. Every
// PBI mention outside code links to its PBI's page, as PbiLinkedText does for plain text.
export function readableMarkdown(text: string): string {
  return linkPbiMentions(unescapedLineBreaks(text));
}

function unescapedLineBreaks(text: string): string {
  return text.includes("\n") ? text : text.replace(/\\r\\n|\\n/g, "\n").replace(/\\t/g, "  ");
}

// Code (fenced or inline) is left alone; [PBI-1](…) already is a link.
const CODE = /(```[\s\S]*?```|`[^`\n]*`)/;
const PBI_MENTION = /(?<![[/\w-])PBI-(\d+)(?!\])/g;

function linkPbiMentions(text: string): string {
  return text.split(CODE).map((part, index) => (index % 2 === 1 ? part : part.replace(PBI_MENTION, "[PBI-$1](/pbis/$1)"))).join("");
}
