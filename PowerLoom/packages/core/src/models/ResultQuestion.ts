// What a research result answers, from its research task: the question (the task's title) and its goal.
export interface ResultQuestion {
  taskId: string;
  question: string;
  goal: string | null;
}
