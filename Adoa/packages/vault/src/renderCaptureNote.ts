import { frontmatter } from "./frontmatter";
import { isoDate } from "./markdown";
import type { CaptureNote } from "./models/CaptureNote";

// Follows the docs vault's draft template (AGENTS.md): facts as given, unverified, with what is still to fill.
export function renderCaptureNote(note: CaptureNote): string {
  const facts = note.captured.map((item) => `- ${item.fact} _(evidence: \`${item.evidence}\`)_`);
  const toFill = note.toFill.map((item) => `- ${item}`);

  return [
    frontmatter({
      title: note.title,
      type: "draft",
      status: "draft",
      project: note.project,
      captured: isoDate(note.created),
      source: note.source,
      target: note.target,
    }),
    `# ${note.title} (draft)`,
    "## Captured",
    facts.join("\n") || "None.",
    "## To fill",
    toFill.join("\n") || "- Verify the facts above against the code and merge into the target note.",
    "",
  ].join("\n\n");
}

// Draft names are unique vault-wide: project key + topic slug (+ capture id on a clash).
export function captureFileName(project: string, title: string, id: number, isTaken: boolean): string {
  const slug = title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-+|-+$/g, "").slice(0, 50).replace(/-+$/, "");

  return `${project}-${slug || "capture"}${isTaken ? `-${id}` : ""}-draft.md`;
}
