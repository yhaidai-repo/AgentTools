namespace PowerLoom.Features.Flows.Engine;

// What one advance did: the execution's status afterwards (null when it doesn't exist) and the tasks it created.
public sealed record FlowAdvanceResult(string ExecutionId, string? Status, IReadOnlyList<string> CreatedTaskIds);
