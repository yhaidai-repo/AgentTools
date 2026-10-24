// A Test Case as the tool saves it for a PBI (table test_case).
export interface TestCaseRecord {
  adoId: number;
  title: string;
  state: string;
  priority: number | null;
  rev: number;
  stepsMd: string;
  parameters: string | null;
}
