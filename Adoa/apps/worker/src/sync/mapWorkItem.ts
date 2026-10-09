import { FIELD, type AdoWorkItem } from "@adoa/ado";
import { htmlToMarkdown } from "@adoa/vault";
import { createHash } from "node:crypto";
import type { MappedWorkItem } from "./models/MappedWorkItem";

export function mapWorkItem(item: AdoWorkItem): MappedWorkItem {
  const fields = item.fields;
  const title = text(fields, FIELD.title) ?? "";
  const descriptionHtml = text(fields, FIELD.description) ?? text(fields, FIELD.reproSteps) ?? "";
  const acceptanceCriteriaHtml = text(fields, FIELD.acceptanceCriteria) ?? "";

  return {
    adoId: item.id,
    rev: item.rev,
    type: text(fields, FIELD.type) ?? "",
    title,
    adoState: text(fields, FIELD.state) ?? "",
    iterationPath: text(fields, FIELD.iterationPath),
    areaPath: text(fields, FIELD.areaPath),
    assignedTo: identity(fields[FIELD.assignedTo]),
    priority: num(fields, FIELD.priority),
    backlogPriority: num(fields, FIELD.backlogPriority),
    effort: num(fields, FIELD.effort),
    remainingWork: num(fields, FIELD.remainingWork),
    adoParentId: num(fields, FIELD.parent),
    tags: splitTags(text(fields, FIELD.tags)),
    adoCreatedAt: toDate(text(fields, FIELD.createdDate)),
    adoChangedAt: toDate(text(fields, FIELD.changedDate)),
    descriptionMd: htmlToMarkdown(descriptionHtml),
    acceptanceCriteriaMd: htmlToMarkdown(acceptanceCriteriaHtml),
    contentHash: hashContent(title, descriptionHtml, acceptanceCriteriaHtml),
  };
}

// Staleness is driven by what agents read: title, description and acceptance criteria.
function hashContent(...parts: string[]): string {
  return createHash("sha256").update(parts.join("\u0000")).digest("hex");
}

function text(fields: Record<string, unknown>, key: string): string | null {
  const value = fields[key];

  return typeof value === "string" && value !== "" ? value : null;
}

function num(fields: Record<string, unknown>, key: string): number | null {
  const value = fields[key];

  return typeof value === "number" ? value : null;
}

function identity(value: unknown): string | null {
  const person = value as { uniqueName?: string; displayName?: string } | undefined;

  return person?.uniqueName ?? person?.displayName ?? null;
}

function toDate(value: string | null): Date | null {
  return value ? new Date(value) : null;
}

function splitTags(tags: string | null): string[] {
  return tags ? tags.split(";").map((tag) => tag.trim()).filter(Boolean) : [];
}
