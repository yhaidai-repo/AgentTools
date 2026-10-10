using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Domain.Pbis;

// The PBI's pipeline status follows its tasks (user decision 2026-10-01): a running agent wins, then the user's open
// items, then the earliest stage with a waiting task; design done → ready for dev.
public static class PipelineStatusDerivation
{
    private const string Human = "human";

    public static PipelineStatus? Derive(IReadOnlyList<LocalItem> items)
    {
        // Only pipeline stages move the status; e.g. a tech-writer task on the PBI doesn't.
        var agentTasks = items.Where(item => AgentStages.StageOf(item.Assignee) is not null).ToList();
        var running = agentTasks.FirstOrDefault(task => task.Status == ItemStatus.InProgress);

        if (running is not null)
            return AgentStages.StageOf(running.Assignee)!.Running;

        if (items.Any(item => item.Assignee == Human && item.Kind != ItemKind.Finding && IsOpen(item)))
            return PipelineStatus.WaitingHuman;

        var waiting = AgentStages.ByAgent.FirstOrDefault(stage => agentTasks.Any(task => task.Assignee == AgentStages.AssigneeOf(stage.Key) && task.Status == ItemStatus.Open));

        if (waiting.Value is not null)
            return waiting.Value.Waiting;

        return agentTasks.Any(task => task.Kind == ItemKind.Design && task.Status == ItemStatus.Done) ? PipelineStatus.ReadyForDev : null;
    }

    public static bool IsOpen(LocalItem item) => item.Status is ItemStatus.Open or ItemStatus.InProgress;
}
