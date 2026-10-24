using PowerLoom.Infrastructure.LocalBranches;
using PowerLoom.Infrastructure.LocalBranches.Models;

namespace PowerLoom.Api.Tests.Probes;

// The PC's branches as DevHub would report them: "<repo>:<branch>" → head; `Reachable` false plays DevHub being off.
public sealed class FakeLocalBranches : ILocalBranches
{
    public Dictionary<string, string> Heads { get; } = [];

    public bool Reachable { get; set; } = true;

    public Task<LocalBranchLookup> FindAsync(string vault, string repo, string branch, CancellationToken cancellation)
    {
        if (!Reachable)
            return Task.FromResult(LocalBranchLookup.Unreachable("DevHub is off."));

        return Task.FromResult(Heads.TryGetValue($"{repo}:{branch}", out var head) ? LocalBranchLookup.Found(head) : LocalBranchLookup.Missing());
    }
}
