using PowerLoom.Persistence.Enums;

namespace PowerLoom.Domain.Pbis;

// How one pipeline agent's tasks look and what they mean for the PBI's status: `Running` while one of its tasks runs,
// `Waiting` while one waits to be dispatched. `Title` names a task the app creates (research tasks get theirs from the
// agent).
public sealed record AgentStage(ItemKind Kind, string Prefix, PipelineStatus Running, PipelineStatus Waiting, string Title);
