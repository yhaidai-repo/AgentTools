namespace PowerLoom.AdoIntegration.Client;

// The work item fields the sync reads, by reference name.
public static class AdoFields
{
    public const string Type = "System.WorkItemType";
    public const string Title = "System.Title";
    public const string State = "System.State";
    public const string IterationPath = "System.IterationPath";
    public const string AreaPath = "System.AreaPath";
    public const string AssignedTo = "System.AssignedTo";
    public const string CreatedDate = "System.CreatedDate";
    public const string ChangedDate = "System.ChangedDate";
    public const string Tags = "System.Tags";
    public const string Description = "System.Description";
    public const string ReproSteps = "Microsoft.VSTS.TCM.ReproSteps";
    public const string AcceptanceCriteria = "Microsoft.VSTS.Common.AcceptanceCriteria";
    public const string Priority = "Microsoft.VSTS.Common.Priority";
    public const string BacklogPriority = "Microsoft.VSTS.Common.BacklogPriority";
    public const string Effort = "Microsoft.VSTS.Scheduling.Effort";
    public const string RemainingWork = "Microsoft.VSTS.Scheduling.RemainingWork";
    public const string OriginalEstimate = "Microsoft.VSTS.Scheduling.OriginalEstimate";
    public const string Parent = "System.Parent";

    public static readonly IReadOnlyList<string> Sync =
    [
        Type, Title, State, IterationPath, AreaPath, AssignedTo, CreatedDate, ChangedDate, Tags, Description, ReproSteps,
        AcceptanceCriteria, Priority, BacklogPriority, Effort, RemainingWork, Parent,
    ];
}
