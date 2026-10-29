import { latestResultPath } from "./resultLinks";

// A PBI mention in agent-written text: `PBI-30270` names the PBI, `PBI-30270:plan` its latest plan (the versioned
// references agents read with read_reference: refinement, plan, build, design or estimate).
export interface PbiMention {
  text: string;
  href: string;
}

// The source of the mention grammar, with the PBI's id and the kind as its capture groups, for callers that need
// their own flags or guards (e.g. not inside an existing markdown link).
export const PBI_MENTION_SOURCE = "(?<![\\w-])PBI-(\\d+)(?::(refinement|plan|build|design|estimate))?\\b";

const PBI_MENTION = new RegExp(PBI_MENTION_SOURCE, "g");

// Where a mention links: the PBI's page, or the latest result of the kind it names.
export function pbiMentionHref(id: string, kind: string | undefined): string {
  return kind ? latestResultPath(kind, Number(id)) : `/pbis/${id}`;
}

// The text in pieces: plain text between the mentions, each mention with its link.
export function splitPbiMentions(text: string): (string | PbiMention)[] {
  const parts: (string | PbiMention)[] = [];
  let last = 0;

  for (const match of text.matchAll(PBI_MENTION)) {
    parts.push(text.slice(last, match.index), { text: match[0], href: pbiMentionHref(match[1], match[2]) });
    last = match.index + match[0].length;
  }

  parts.push(text.slice(last));

  return parts.filter((part) => part !== "");
}
