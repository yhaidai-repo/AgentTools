// A record to add to a register (the user submitted a finding).
export interface NewRegisterRecord {
  context?: { pbiId?: number; taskId?: string; chatId?: string; sessionId?: string };
  project: string;
  kind: "questions" | "issues";
  title: string;
  text: string;
  default: string[];
  options: string[];
}
