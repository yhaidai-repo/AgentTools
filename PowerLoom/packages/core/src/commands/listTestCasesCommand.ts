import { z } from "zod";
import type { Command } from "../models/Command";
import type { TestCaseRow } from "../models/TestCaseRow";
import { listTestCases } from "../tasks/testCases";
import { pbiIdInput } from "./inputs";

const input = z.object({ pbiId: pbiIdInput });

interface ListTestCasesValue {
  testCases: TestCaseRow[];
  /** How a chat reads one case in full. */
  hint: string;
}

const HINT = "pbi.read with ref TC-<adoId> gives the case in full (its steps and parameters).";

export const listTestCasesCommand: Command<{ pbiId: number }, ListTestCasesValue> = {
  name: "testcase.list",
  effect: "read",
  description: "List the Azure DevOps Test Cases saved for a PBI (title, state, step count, when fetched). Empty when none were fetched yet. Pass TC-<adoId> to pbi.read for a case's steps.",
  input,
  async run(context, input) {
    const testCases = await listTestCases(context.db, input.pbiId);

    return { ok: true, value: { testCases, hint: HINT } };
  },
};
