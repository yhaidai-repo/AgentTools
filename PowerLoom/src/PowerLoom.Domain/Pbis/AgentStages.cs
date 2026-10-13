using PowerLoom.Persistence.Enums;

namespace PowerLoom.Domain.Pbis;

// The pipeline agents, in order. An agent without a stage here gets no PBI tasks (e.g. the tech writer).
public static class AgentStages
{
    public const string Refinement = "refinement";
    public const string Research = "research";
    public const string BetterResearch = "better-research";
    public const string Design = "design";

    private const string AgentPrefix = "agent:";

    public static readonly IReadOnlyDictionary<string, AgentStage> ByAgent = new Dictionary<string, AgentStage>
    {
        [Refinement] = new(ItemKind.Refinement, "RT", PipelineStatus.Refining, PipelineStatus.ReadyForRefinement, "Refine the PBI"),
        [Research] = new(ItemKind.Research, "AT", PipelineStatus.Researching, PipelineStatus.NeedsResearch, "Research the PBI"),
        [BetterResearch] = new(ItemKind.Research, "AT", PipelineStatus.Researching, PipelineStatus.NeedsResearch, "Research the PBI"),
        [Design] = new(ItemKind.Design, "DT", PipelineStatus.Designing, PipelineStatus.ReadyForDesign, "Design the implementation"),
    };

    public static string AssigneeOf(string agentId) => $"{AgentPrefix}{agentId}";

    public static string? AgentIdOf(string assignee) => assignee.StartsWith(AgentPrefix, StringComparison.Ordinal) ? assignee[AgentPrefix.Length..] : null;

    public static AgentStage? StageOf(string assignee) => AgentIdOf(assignee) is { } agentId && ByAgent.TryGetValue(agentId, out var stage) ? stage : null;
}
