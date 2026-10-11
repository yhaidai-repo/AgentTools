using PowerLoom.Persistence.Enums;

namespace PowerLoom.Features.Status.Models;

// A sync or pull-request check run (the Runs page's rows for those stages), newest first.
public sealed record SyncRun(long Id, Stage Stage, RunOutcome Outcome, string? Error, DateTimeOffset StartedAt, DateTimeOffset? EndedAt);
