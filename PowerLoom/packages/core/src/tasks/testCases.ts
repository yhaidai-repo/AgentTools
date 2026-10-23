import { testCase, type PowerLoomDb } from "@powerloom/db";
import { asc, eq } from "drizzle-orm";
import type { TestCaseRow } from "../models/TestCaseRow";

// The Test Cases the agents saved for the PBI (packages/agents saveTestCases), without their steps.
export async function listTestCases(db: PowerLoomDb, pbiId: number): Promise<TestCaseRow[]> {
  const rows = await db
    .select({ adoId: testCase.adoId, title: testCase.title, state: testCase.state, stepsMd: testCase.stepsMd, fetchedAt: testCase.fetchedAt })
    .from(testCase)
    .where(eq(testCase.pbiId, pbiId))
    .orderBy(asc(testCase.adoId));

  return rows.map((row) => ({ id: `TC-${row.adoId}`, adoId: row.adoId, title: row.title, state: row.state, steps: countSteps(row.stepsMd), updatedAt: row.fetchedAt }));
}

// The steps are a numbered markdown list, one top-level number per step (the agents' testCaseMarkdown).
function countSteps(stepsMd: string): number {
  return stepsMd.split("\n").filter((line) => /^\d+\. /.test(line)).length;
}
