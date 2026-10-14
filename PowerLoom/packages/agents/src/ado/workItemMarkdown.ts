import { FIELD, linkedWorkItemId, type AdoComment, type AdoRelation, type AdoWorkItem, type AdoWorkItemWithRelations } from "@powerloom/ado";
import { htmlToMarkdown } from "@powerloom/vault";

type Identity = { displayName?: string; uniqueName?: string };

// Rich-text fields, shown as sections; every other field is one line.
const TEXT_FIELDS: Record<string, string> = {
  [FIELD.description]: "Description",
  [FIELD.reproSteps]: "Repro steps",
  [FIELD.acceptanceCriteria]: "Acceptance criteria",
  "Microsoft.VSTS.TCM.SystemInfo": "System info",
};

// The title is in the heading; the others are bookkeeping that tells an agent nothing.
const HIDDEN_FIELDS = new Set<string>([
  FIELD.title,
  "System.Id",
  "System.Rev",
  "System.Watermark",
  "System.AuthorizedAs",
  "System.AuthorizedDate",
  "System.RevisedDate",
  "System.PersonId",
  "System.AreaId",
  "System.IterationId",
  "System.NodeName",
  "System.TeamProject",
  "System.CommentCount",
]);

// A one-line field longer than this is cut: the long content lives in the text fields.
const FIELD_CHARS = 300;

export function workItemMarkdown(item: AdoWorkItemWithRelations, comments: AdoComment[] | null): string {
  const heading = `# ${text(item.fields[FIELD.type])} ${item.id}: ${text(item.fields[FIELD.title])} (rev ${item.rev})`;

  return [heading, fieldsSection(item), ...textSections(item), linksSection(item.relations), commentsSection(comments)].filter(Boolean).join("\n\n");
}

export function workItemListText(items: AdoWorkItem[]): string {
  if (items.length === 0) {
    return "No work items match.";
  }

  return items.map(workItemLine).join("\n");
}

function workItemLine(item: AdoWorkItem): string {
  const assigned = fieldValue(item.fields[FIELD.assignedTo]) || "unassigned";

  return `- ${item.id} ${text(item.fields[FIELD.type])} [${text(item.fields[FIELD.state])}] ${text(item.fields[FIELD.title])} – ${assigned}, ${text(item.fields[FIELD.iterationPath])}`;
}

function fieldsSection(item: AdoWorkItem): string {
  const shown = Object.entries(item.fields).filter(([name]) => !(name in TEXT_FIELDS) && !HIDDEN_FIELDS.has(name));
  const values = shown.map(([name, value]) => [name, fieldValue(value)] as const).filter(([, value]) => value !== "");

  return ["## Fields", ...values.map(([name, value]) => `- ${name}: ${value}`)].join("\n");
}

function textSections(item: AdoWorkItem): string[] {
  const given = Object.entries(TEXT_FIELDS).filter(([name]) => text(item.fields[name]).trim() !== "");

  return given.map(([name, label]) => `## ${label}\n\n${htmlToMarkdown(text(item.fields[name]))}`);
}

function linksSection(relations: AdoRelation[]): string {
  if (relations.length === 0) {
    return "## Links\n\nNone.";
  }

  return ["## Links", ...relations.map(linkLine)].join("\n");
}

function linkLine(link: AdoRelation): string {
  const comment = link.comment ? ` – ${link.comment}` : "";

  return `- ${link.name ?? link.rel}: ${linkTarget(link)}${comment}`;
}

// Work item links end in the id; pull requests and commits are artifact links ending in "<project>/<repo>/<id or sha>".
function linkTarget(link: AdoRelation): string {
  if (/\/workItems\/\d+$/i.test(link.url)) {
    return `work item ${linkedWorkItemId(link)}`;
  }

  const artifact = /^vstfs:\/\/\/Git\/(PullRequestId|Commit)\/(.+)$/i.exec(link.url);

  if (!artifact) {
    return link.url;
  }

  const id = decodeURIComponent(artifact[2]).split("/").pop();

  return artifact[1].toLowerCase() === "commit" ? `commit ${id}` : `PR ${id}`;
}

function commentsSection(comments: AdoComment[] | null): string {
  if (comments === null) {
    return "";
  }

  if (comments.length === 0) {
    return "## Comments\n\nNone.";
  }

  return ["## Comments (the newest, oldest first)", ...comments.map(commentText)].join("\n\n");
}

function commentText(comment: AdoComment): string {
  return `### ${comment.author ?? "unknown"} · ${comment.createdAt?.slice(0, 10) ?? "unknown"}\n\n${htmlToMarkdown(comment.text)}`;
}

function fieldValue(value: unknown): string {
  if (isIdentity(value)) {
    return value.displayName ?? value.uniqueName ?? "";
  }

  if (value === null || value === undefined || typeof value === "object") {
    return "";
  }

  const plain = htmlToMarkdown(String(value)).replaceAll(/\s*\n\s*/g, " ");

  return plain.length > FIELD_CHARS ? `${plain.slice(0, FIELD_CHARS)}…` : plain;
}

function isIdentity(value: unknown): value is Identity {
  return typeof value === "object" && value !== null && ("displayName" in value || "uniqueName" in value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}
