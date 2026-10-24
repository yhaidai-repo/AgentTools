// What a run adds to its task's data when it handed work on: the dispatcher holds the task while any of these items is
// open (PowerLoom's TaskDependencies), and the next run reads their results.
export interface WaitingTaskData {
  dependsOn?: string[];
}
