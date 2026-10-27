/// <reference path="./js-yaml.d.ts" />
import { FAILSAFE_SCHEMA, load } from "js-yaml";

export function frontmatterField(text: string, field: string): string | null {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? "";

  try {
    const parsed: unknown = load(frontmatter, { schema: FAILSAFE_SCHEMA });
    const value = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>)[field] : null;

    return typeof value === "string" ? value.trim() : null;
  } catch {
    return null;
  }
}
