using PowerLoom.Domain.Tasks;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Domain.Pbis;

// The pipeline agents, in order. An agent without a stage here gets no PBI tasks (e.g. the tech writer).
public static class AgentStages
{
    public const string Refinement = "refinement";
    public const string Research = "research";
    public const string BetterResearch = "better-research";
    public const string BetterRefinement = "better-refinement";
    public const string Design = "design";

    private const string AgentPrefix = "agent:";

    /// <summary>A task any agent that handles its kind may take (user decision 2026-10-13); `agent:&lt;id&gt;` pins one agent.</summary>
    public const string AnyAgent = "agent:*";

    public static readonly IReadOnlyDictionary<string, AgentStage> ByAgent = new Dictionary<string, AgentStage>
    {
        [Refinement] = new(ItemKind.Refinement, "RT", PipelineStatus.Refining, PipelineStatus.ReadyForRefinement, "Refine the PBI"),
        [BetterRefinement] = new(ItemKind.Refinement, "RT", PipelineStatus.Refining, PipelineStatus.ReadyForRefinement, "Refine the PBI"),
        [Research] = new(ItemKind.Research, "AT", PipelineStatus.Researching, PipelineStatus.NeedsResearch, "Research the PBI"),
        [BetterResearch] = new(ItemKind.Research, "AT", PipelineStatus.Researching, PipelineStatus.NeedsResearch, "Research the PBI"),
        [Design] = new(ItemKind.Design, "DT", PipelineStatus.Designing, PipelineStatus.ReadyForDesign, "Design the implementation"),
    };

    public static string AssigneeOf(string agentId) => $"{AgentPrefix}{agentId}";

    public static string? AgentIdOf(string assignee) => assignee.StartsWith(AgentPrefix, StringComparison.Ordinal) ? assignee[AgentPrefix.Length..] : null;

    public static bool IsAgentTask(string assignee) => assignee.StartsWith(AgentPrefix, StringComparison.Ordinal);

    /// <summary>The pipeline stage a task of this kind belongs to, whichever agent takes it; null for other kinds.</summary>
    public static AgentStage? StageOfKind(ItemKind kind) => Pipeline.FirstOrDefault(stage => stage.Kind == kind);

    /// <summary>The stages in pipeline order, one per task kind.</summary>
    public static IReadOnlyList<AgentStage> Pipeline => [ByAgent[Refinement], ByAgent[Research], ByAgent[Design]];

    /// <summary>Who works on an agent task, for messages: the pinned agent, or "any &lt;kind&gt; agent".</summary>
    public static string WorkerOf(LocalItem task) => task.Assignee == AnyAgent ? $"any {TaskKinds.Label(task.Kind)} agent" : AgentIdOf(task.Assignee) ?? task.Assignee;
}
