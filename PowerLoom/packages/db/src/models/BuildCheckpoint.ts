// A checkpoint an executor stopped at (## CHECKPOINT REACHED) and how the implementation agent settled it.
export interface BuildCheckpoint {
  plan: string;
  text: string;
  resolution: string;
}
