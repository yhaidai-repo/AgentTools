type FrontmatterValue = string | number | boolean | null | string[];

// JSON strings are valid YAML double-quoted scalars, which also keeps [[links]] intact.
export function frontmatter(fields: Record<string, FrontmatterValue>): string {
  const lines = Object.entries(fields).map(([key, value]) => `${key}: ${yamlValue(value)}`);

  return `---\n${lines.join("\n")}\n---`;
}

function yamlValue(value: FrontmatterValue): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => JSON.stringify(item)).join(", ")}]`;
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  return String(value);
}
