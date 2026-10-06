// What any chat launcher opens, provider neutral: the folder, the folders to attach, and the instructions.
export interface ChatRequest {
  title: string; // first line, e.g. "Implement PBI-123: …"
  intro: string[]; // context before the steps, e.g. a finding's text
  folder: string;
  extraFolders: string[]; // added to the session: repos, and the backlog when the chat reads its notes
  steps: string[]; // in order: what to read, the briefing, the one question to end with
}
