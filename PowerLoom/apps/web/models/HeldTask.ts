// An open agent task the dispatcher didn't start, with its reasons (held_by).
export interface HeldTask {
  id: string;
  kind: string;
  title: string;
  pbiId: number | null;
  vault: string;
  heldBy: string[];
  updatedAt: Date;
}
