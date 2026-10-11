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
