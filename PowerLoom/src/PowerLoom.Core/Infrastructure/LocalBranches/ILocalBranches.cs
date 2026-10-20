using PowerLoom.Infrastructure.LocalBranches.Models;

namespace PowerLoom.Infrastructure.LocalBranches;

// Branches on the user's PC (user decision 2026-10-21: a branch review may name a branch that isn't pushed). Only
// DevHub runs on the PC, so it answers; the containers can't see the disk.
public interface ILocalBranches
{
    Task<LocalBranchLookup> FindAsync(string vault, string repo, string branch, CancellationToken cancellation);
}
