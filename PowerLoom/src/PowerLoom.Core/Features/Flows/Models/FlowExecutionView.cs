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
    FlowDefinitionInput Definition);
