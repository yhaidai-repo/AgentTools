// A task the app (not an agent) hands to the person, e.g. fixing a vault draft VaultCapture rejected.
export interface NewHumanTask {
  adoId: number;
  title: string;
  body: string;
  runId: number | null;
  data: Record<string, unknown> | null;
}
