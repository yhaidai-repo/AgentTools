using PowerLoom.AdoIntegration.Client.Models;

namespace PowerLoom.AdoIntegration.Features.SyncPbis.Models;

// What one sync pulls: the parents of the user's sprint Tasks (AllIds) and those Tasks that are QA bugs (BugIds).
// `ChildEffort`: parent id → the Effort of the user's Tasks under it (ChildTaskEffort).
public sealed record SyncScope(IReadOnlyList<int> AllIds, IReadOnlyList<int> BugIds, AdoIteration Sprint, IReadOnlyDictionary<int, decimal> ChildEffort);
