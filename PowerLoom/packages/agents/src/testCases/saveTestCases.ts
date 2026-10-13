import { testCase, type PowerLoomDb } from "@powerloom/db";
import { and, eq, notInArray, sql } from "drizzle-orm";
import type { TestCaseRecord } from "../models/TestCaseRecord";

const UPDATED = {
  title: sql`excluded.title`,
  state: sql`excluded.state`,
  priority: sql`excluded.priority`,
  rev: sql`excluded.rev`,
  stepsMd: sql`excluded.steps_md`,
  parameters: sql`excluded.parameters`,
  fetchedAt: sql`now()`,
};

// The PBI's test cases become exactly what Azure DevOps links now: new and changed ones are written, unlinked ones go.
export async function saveTestCases(db: PowerLoomDb, pbiId: number, cases: TestCaseRecord[]): Promise<void> {
  const kept = cases.map((item) => item.adoId);
  const unlinked = kept.length > 0 ? and(eq(testCase.pbiId, pbiId), notInArray(testCase.adoId, kept)) : eq(testCase.pbiId, pbiId);

  await db.transaction(async (tx) => {
    await tx.delete(testCase).where(unlinked);

    if (cases.length === 0) {
      return;
    }

    await tx.insert(testCase).values(cases.map((item) => ({ pbiId, ...item }))).onConflictDoUpdate({ target: [testCase.pbiId, testCase.adoId], set: UPDATED });
  });
}
