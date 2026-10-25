/** A recorded warning or error as the tools show it. */
export interface LogEntryView {
  service: string;
  level: string;
  /** How often it happened: repeats (the same message but its numbers) are one entry. */
  count: number;
  firstAt: Date;
  lastAt: Date;
  /** The latest occurrence's text. */
  message: string;
  run: string | null;
  taskId: string | null;
  pbiId: number | null;
  vault: string | null;
}
