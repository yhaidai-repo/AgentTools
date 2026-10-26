// An agent task's own text as the user corrects it (user decision 2026-10-26): what the New task form takes.
export interface TaskEdit {
  adoId: number | null;
  itemId: string;
  title: string;
  description: string;
  acceptanceCriteria: string;
}
