// One run's view of the PBI's unread web pages: the pages it may save notes on or ask the user for, and who saves them.
export interface WebDocumentRun {
  adoId: number;
  agentId: string;
  taskId: string;
  runId: number;
  urls: string[];
}
