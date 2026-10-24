using PowerLoom.Persistence.Enums;

namespace PowerLoom.AdoIntegration.Features.SyncPbis;

// A PBI went to another team member when ADO moves it from the user to someone else; the sync then closes it (user
// decision 2026-10-21). Only a PBI in the pipeline: a new one has nothing waiting yet, a done or closed one is over.
public static class ReassignmentRule
{
    private static readonly PipelineStatus[] NotInPipeline = [PipelineStatus.New, PipelineStatus.Done, PipelineStatus.Closed];

    public static bool ClosesPbi(PipelineStatus status, string? assignedBefore, string? assignedNow, string user)
    {
        return !NotInPipeline.Contains(status) && IsUser(assignedBefore, user) && !string.IsNullOrEmpty(assignedNow) && !IsUser(assignedNow, user);
    }

    private static bool IsUser(string? assignee, string user) => string.Equals(assignee, user, StringComparison.OrdinalIgnoreCase);
}
