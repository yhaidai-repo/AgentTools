// The step a restore runs now.
export interface RestoreStepNow {
  /** 1 for the first step. */
  number: number;
  label: string;
  startedAt: string;
}
