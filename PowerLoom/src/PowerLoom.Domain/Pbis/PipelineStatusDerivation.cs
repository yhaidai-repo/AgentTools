using PowerLoom.Domain.Tasks;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Domain.Pbis;

// The PBI's pipeline status follows its tasks (user decision 2026-10-01): a running agent wins, then the user's open
// items, then the earliest stage with a waiting task. Ready for dev once refinement or design is done and no blocker is
// left (user decision 2026-10-13): no open task, no open blocking item, no stuck stage.
public static class PipelineStatusDerivation
{
    private const string Human = "human";
    private const string Blocking = "blocking";

    public static PipelineStatus? Derive(IReadOnlyList<LocalItem> items)
    {
        var blockers = items.Where(IsBlocker).ToList();
        // Only pipeline stages move the status; e.g. a tech-writer task on the PBI doesn't.
        var agentTasks = blockers.Where(item => AgentStages.IsAgentTask(item.Assignee) && AgentStages.StageOfKind(item.Kind) is not null).ToList();
        var running = agentTasks.FirstOrDefault(task => task.Status == ItemStatus.InProgress);

        if (running is not null)
            return AgentStages.StageOfKind(running.Kind)!.Running;

        if (blockers.Any(item => item.Assignee == Human && item.Kind != ItemKind.Finding && IsOpen(item)))
            return PipelineStatus.WaitingHuman;

        var waiting = AgentStages.Pipeline.FirstOrDefault(stage => agentTasks.Any(task => task.Kind == stage.Kind && task.Status == ItemStatus.Open));

        if (waiting is not null)
            return waiting.Waiting;

        // A stage that gave up (failed too often, over budget) still owes its answer, so the PBI keeps its status.
        if (agentTasks.Any(task => task.Status == ItemStatus.Blocked))
            return null;

        return agentTasks.Any(IsFinishedPlanStage) ? PipelineStatus.ReadyForDev : null;
    }

    public static bool IsOpen(LocalItem item) => item.Status is ItemStatus.Open or ItemStatus.InProgress;

    // Agents mark what they create; an item without the mark (everything before chaining v2) counts as a blocker.
    private static bool IsBlocker(LocalItem item) => ItemData.BoolOf(item.Data, Blocking) != false;

    private static bool IsFinishedPlanStage(LocalItem task) => task.Kind is ItemKind.Refinement or ItemKind.Design && task.Status == ItemStatus.Done;
}
