import { TESTED_BY_RELATION, TEST_CASE_FIELD, TEST_CASE_FIELDS, parseTestSteps, type AdoClient, type AdoWorkItem, type TestStep } from "@powerloom/ado";
import type { TestCaseRecord } from "../models/TestCaseRecord";
import { stepsMarkdown } from "./testCaseMarkdown";

// The Test Cases a PBI links with Tested By, read from Azure DevOps with their Shared Steps.
export async function fetchTestCases(client: AdoClient, pbiId: number): Promise<TestCaseRecord[]> {
  const ids = await client.getLinkedIds(pbiId, TESTED_BY_RELATION);

  if (ids.length === 0) {
    return [];
  }

  const items = await client.getWorkItems(ids, TEST_CASE_FIELDS);
  const stepsById = new Map(items.map((item) => [item.id, parseTestSteps(stringField(item, TEST_CASE_FIELD.steps))]));
  const sharedSteps = await readSharedSteps(client, [...stepsById.values()]);

  return items.map((item) => toRecord(item, stepsMarkdown(stepsById.get(item.id) ?? [], sharedSteps)));
}

async function readSharedSteps(client: AdoClient, cases: TestStep[][]): Promise<Map<number, TestStep[]>> {
  const ids = [...new Set(cases.flat().flatMap((step) => (step.kind === "shared" ? [step.sharedStepsId] : [])))];

  if (ids.length === 0) {
    return new Map();
  }

  const items = await client.getWorkItems(ids, [TEST_CASE_FIELD.steps]);

  return new Map(items.map((item) => [item.id, parseTestSteps(stringField(item, TEST_CASE_FIELD.steps))]));
}

function toRecord(item: AdoWorkItem, stepsMd: string): TestCaseRecord {
  const priority = item.fields[TEST_CASE_FIELD.priority];

  return {
    adoId: item.id,
    title: stringField(item, TEST_CASE_FIELD.title) ?? `Test Case ${item.id}`,
    state: stringField(item, TEST_CASE_FIELD.state) ?? "",
    priority: typeof priority === "number" ? priority : null,
    rev: item.rev,
    stepsMd,
    parameters: parametersOf(item),
  };
}

// The parameter names and their data rows, as ADO stores them (XML); nothing when the case has no parameters.
function parametersOf(item: AdoWorkItem): string | null {
  const parameters = stringField(item, TEST_CASE_FIELD.parameters);
  const data = stringField(item, TEST_CASE_FIELD.localDataSource);

  return parameters ? [parameters, data].filter(Boolean).join("\n") : null;
}

function stringField(item: AdoWorkItem, field: string): string | undefined {
  const value = item.fields[field];

  return typeof value === "string" ? value : undefined;
}
