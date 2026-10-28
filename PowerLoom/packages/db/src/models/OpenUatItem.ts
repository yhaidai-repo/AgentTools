// A UAT test verify-work couldn't settle without a person (pending, skipped, blocked or an issue): one step of the
// hand-over task.
export interface OpenUatItem {
  phase: string;
  test: string;
  name: string;
  result: string;
  reason: string;
}
