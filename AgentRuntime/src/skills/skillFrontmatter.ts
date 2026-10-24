export function frontmatterField(text: string, field: string): string | null {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? "";
  const value = new RegExp(`^${field}:\s*(.+)$`, "m").exec(frontmatter)?.[1];

  return value?.trim().replace(/^["']|["']$/g, "") ?? null;
}
