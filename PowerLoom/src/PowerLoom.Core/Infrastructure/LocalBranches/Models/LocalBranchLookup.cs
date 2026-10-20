namespace PowerLoom.Infrastructure.LocalBranches.Models;

// What DevHub said about a branch on the PC: `Reachable` false when DevHub is off or doesn't answer (then nothing is
// known); `Head` the branch's commit, null when the checkout has no such branch.
public sealed record LocalBranchLookup(bool Reachable, string? Head, string? Problem)
{
    public static LocalBranchLookup Unreachable(string problem) => new(false, null, problem);

    public static LocalBranchLookup Missing() => new(true, null, null);

    public static LocalBranchLookup Found(string head) => new(true, head, null);
}
