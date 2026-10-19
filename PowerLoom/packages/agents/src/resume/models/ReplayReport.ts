// The earlier calls taken again in a continued run: draft calls per tool, reads restored, and the draft calls that
// failed this time.
export interface ReplayReport {
  replayed: Record<string, number>;
  restored: number;
  failed: string[];
}
