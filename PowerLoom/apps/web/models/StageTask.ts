// One agent task of a PBI as the metro line counts it: its kind, whether it finished and how many runs it took.
export interface StageTask {
  kind: string;
  isDone: boolean;
  runs: number;
}
