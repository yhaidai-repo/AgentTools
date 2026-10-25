using System.Text.RegularExpressions;

namespace PowerLoom.Domain.Repos;

// A local repo's branch heads, read from its git files in the repos root (the backend has no git): the loose ref under
// .git/refs/heads, else the line in .git/packed-refs. Only branch names git allows reach the file system.
public static partial class GitRefs
{
    private const string HeadsRef = "refs/heads/";

    public static bool IsBranchName(string name)
    {
        return BranchName().IsMatch(name) && name.Split('/').All(part => part.Length > 0 && !part.StartsWith('.') && !part.EndsWith(".lock", StringComparison.Ordinal));
    }

    /// <summary>The branch's head commit, or null when the checkout has no such branch.</summary>
    public static string? HeadOf(string checkout, string branch)
    {
        if (!IsBranchName(branch))
            return null;

        return LooseHead(checkout, branch) ?? PackedHead(checkout, branch);
    }

    /// <summary>The branch the checkout has out (its HEAD), or null on a detached HEAD or no checkout.</summary>
    public static string? CurrentBranch(string checkout)
    {
        var path = Path.Combine(checkout, ".git", "HEAD");
        var head = File.Exists(path) ? File.ReadAllText(path).Trim() : "";

        return head.StartsWith("ref: " + HeadsRef, StringComparison.Ordinal) ? head[("ref: " + HeadsRef).Length..] : null;
    }

    private static string? LooseHead(string checkout, string branch)
    {
        var path = Path.Combine([checkout, ".git", "refs", "heads", .. branch.Split('/')]);

        return File.Exists(path) ? Sha(File.ReadAllText(path)) : null;
    }

    private static string? PackedHead(string checkout, string branch)
    {
        var path = Path.Combine(checkout, ".git", "packed-refs");
        var suffix = " " + HeadsRef + branch;

        if (!File.Exists(path))
            return null;

        return File.ReadLines(path).Where(line => line.EndsWith(suffix, StringComparison.Ordinal)).Select(line => Sha(line[..^suffix.Length])).FirstOrDefault(sha => sha is not null);
    }

    private static string? Sha(string text)
    {
        var trimmed = text.Trim();

        return CommitSha().IsMatch(trimmed) ? trimmed : null;
    }

    [GeneratedRegex(@"^[\w.+/-]+$")]
    private static partial Regex BranchName();

    [GeneratedRegex("^[0-9a-f]{40}([0-9a-f]{24})?$")]
    private static partial Regex CommitSha();
}
