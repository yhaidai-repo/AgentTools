using PowerLoom.Domain.Tasks;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Domain.Pbis;

// The PBI pipeline's stages, in order, one per task type (user decision 2026-10-13: there are task types, not agent
// types). Any enabled agent whose `handles` lists a type takes its tasks; other task types (docs, review) have no stage.
public static class AgentStages
{
    private const string AgentPrefix = "agent:";

    /// <summary>The agent id of "any agent that takes the type", e.g. on a schedule by task type.</summary>
    public const string AnyAgentId = "*";

    /// <summary>A task for any agent that takes its type; `agent:&lt;id&gt;` pins one agent.</summary>
    public const string AnyAgent = AgentPrefix + AnyAgentId;

    /// <summary>The stages in pipeline order.</summary>
    public static readonly IReadOnlyList<AgentStage> Pipeline =
    [
        new(ItemKind.Refinement, "RT", PipelineStatus.Refining, PipelineStatus.ReadyForRefinement, "Refine the PBI"),
        new(ItemKind.Research, "AT", PipelineStatus.Researching, PipelineStatus.NeedsResearch, "Research the PBI"),
        new(ItemKind.Design, "DT", PipelineStatus.Designing, PipelineStatus.ReadyForDesign, "Design the implementation"),
        new(ItemKind.Test, "TT", PipelineStatus.Testing, PipelineStatus.ReadyForTest, "Test the PBI"),
    ];

    public static string AssigneeOf(string agentId) => $"{AgentPrefix}{agentId}";

    public static string? AgentIdOf(string assignee) => assignee.StartsWith(AgentPrefix, StringComparison.Ordinal) ? assignee[AgentPrefix.Length..] : null;

    public static bool IsAgentTask(string assignee) => assignee.StartsWith(AgentPrefix, StringComparison.Ordinal);

    /// <summary>The pipeline stage of a task type; null for types without one.</summary>
    public static AgentStage? StageOfKind(ItemKind kind) => Pipeline.FirstOrDefault(stage => stage.Kind == kind);

    /// <summary>The id prefix of a PBI task of this type; null for types that take no PBI.</summary>
    public static string? PbiPrefixOf(ItemKind kind) => StageOfKind(kind)?.Prefix;

    /// <summary>Who works on an agent task, for messages: the pinned agent, or any agent taking its type.</summary>
    public static string WorkerOf(LocalItem task) => task.Assignee == AnyAgent ? $"any agent taking {TaskKinds.Label(task.Kind)} tasks" : AgentIdOf(task.Assignee) ?? task.Assignee;
}
