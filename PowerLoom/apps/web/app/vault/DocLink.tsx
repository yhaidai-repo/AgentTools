import type { ReactNode } from "react";
import { obsidianDocsLink } from "@/lib/obsidian";

// Opens the vault's note in Obsidian. The label defaults to the path.
export function DocLink({ vault, path, children }: { vault: string; path: string; children?: ReactNode }) {
  const href = obsidianDocsLink(path, vault);
  const label = children ?? path;

  return href ? <a href={href}>{label}</a> : <span>{label}</span>;
}
