import { refinement, type AdoaDb } from "@adoa/db";
import { desc, eq } from "drizzle-orm";

const NO_PROJECT = "common";

// The docs-vault project a PBI belongs to: the folder most of refinement's relevant docs are in ("pvs/…" → pvs).
export async function pbiDocsProject(db: AdoaDb, adoId: number): Promise<string> {
  const [latest] = await db.select({ docs: refinement.relevantDocs }).from(refinement).where(eq(refinement.pbiId, adoId)).orderBy(desc(refinement.version)).limit(1);
  const folders = (latest?.docs ?? []).map((doc) => doc.path.split("/")[0]).filter((folder) => folder && !folder.endsWith(".md"));

  return mostCommon(folders) ?? NO_PROJECT;
}

function mostCommon(values: string[]): string | null {
  const counts = new Map<string, number>();

  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}
