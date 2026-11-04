namespace PowerLoom.Features.Flows.Models;

public sealed record FlowExecutionView(
    string Id,
    string FlowId,
    int FlowVersion,
    string Vault,
    string TargetKind,
    int? PbiId,
    string? ItemId,
    string Status,
    string? Error,
    DateTime StartedAt,
    DateTime? FinishedAt,
    FlowDefinitionInput Definition,
    List<FlowStepView> Steps);

// One agent node of the execution and the task that stands for it (phase 2): the task's status (kebab-case, as the
// item_status enum spells it), or "pending" while the execution runs without one, "skipped" once it finished without.
public sealed record FlowStepView(string NodeId, string? ItemId, string Status, int Runs, string Agent, string Kind);
