// One record of a project's open-questions or known-issues register.
export interface RegisterRecord {
  id: string;
  title: string;
  status: string;
  resolved: boolean;
}
