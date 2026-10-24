export const FIELD = {
  type: "System.WorkItemType",
  title: "System.Title",
  state: "System.State",
  iterationPath: "System.IterationPath",
  areaPath: "System.AreaPath",
  assignedTo: "System.AssignedTo",
  createdDate: "System.CreatedDate",
  changedDate: "System.ChangedDate",
  tags: "System.Tags",
  description: "System.Description",
  reproSteps: "Microsoft.VSTS.TCM.ReproSteps",
  acceptanceCriteria: "Microsoft.VSTS.Common.AcceptanceCriteria",
  priority: "Microsoft.VSTS.Common.Priority",
  backlogPriority: "Microsoft.VSTS.Common.BacklogPriority",
  effort: "Microsoft.VSTS.Scheduling.Effort",
  remainingWork: "Microsoft.VSTS.Scheduling.RemainingWork",
  parent: "System.Parent",
} as const;

export const SYNC_FIELDS: string[] = Object.values(FIELD);

// A Test Case's fields (not synced: read on demand by the test case tool). Steps hold XML; Shared Steps items keep
// theirs in the same field.
export const TEST_CASE_FIELD = {
  type: "System.WorkItemType",
  title: "System.Title",
  state: "System.State",
  priority: "Microsoft.VSTS.Common.Priority",
  steps: "Microsoft.VSTS.TCM.Steps",
  parameters: "Microsoft.VSTS.TCM.Parameters",
  localDataSource: "Microsoft.VSTS.TCM.LocalDataSource",
} as const;

export const TEST_CASE_FIELDS: string[] = Object.values(TEST_CASE_FIELD);

// The link from a PBI to the Test Cases that test it ("Tested By").
export const TESTED_BY_RELATION = "Microsoft.VSTS.Common.TestedBy-Forward";
