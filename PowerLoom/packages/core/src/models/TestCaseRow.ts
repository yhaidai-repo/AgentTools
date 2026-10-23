// One Test Case of a PBI as testcase.list answers it; pbi.read with the id gives the steps.
export interface TestCaseRow {
  /** `TC-<adoId>`, the reference pbi.read takes. */
  id: string;
  adoId: number;
  title: string;
  state: string;
  /** How many steps the case has. */
  steps: number;
  /** When the case was last fetched from Azure DevOps. */
  updatedAt: Date;
}
