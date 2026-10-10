using PowerLoom.Persistence.Enums;

namespace PowerLoom.AdoIntegration.Features.SyncPbis.Models;

public sealed record SyncOutcome(RunOutcome Outcome, string Message);
