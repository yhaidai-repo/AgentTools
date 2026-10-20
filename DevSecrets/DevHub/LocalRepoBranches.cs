using System.Diagnostics;
using System.Text.RegularExpressions;
using DevSecrets.DevHub.Config;
using DevSecrets.DevHub.Models;

namespace DevSecrets.DevHub;

// Branches of the repos' checkouts on this PC (user decision 2026-10-21: PowerLoom's branch reviews may name a branch
// that isn't pushed). A repo is found by its map.json key or its folder name, case-insensitively (PowerLoom names it
// as the ADO catalog does, e.g. "PVS" for pvs → D:/Projects/PVS).
public sealed partial class LocalRepoBranches(DevSecretsFiles files)
{
    private static readonly TimeSpan GitTimeout = TimeSpan.FromSeconds(10);

    public async Task<HubResult<LocalBranch>> FindAsync(string repo, string branch, CancellationToken cancellation)
    {
        if (!BranchName().IsMatch(branch))
            return HubResult<LocalBranch>.From(HubResult.Invalid($"Invalid branch name: {branch}"));

        var root = RootOf(repo);

        if (root is null)
            return HubResult<LocalBranch>.From(HubResult.NotFound($"No checkout of {repo} in map.json repos."));

        var head = await HeadAsync(root, branch, cancellation);

        if (head is null)
            return HubResult<LocalBranch>.From(HubResult.NotFound($"{repo} at {root} has no branch {branch}."));

        return HubResult<LocalBranch>.Ok(new LocalBranch(repo, branch, head));
    }

    private string? RootOf(string repo)
    {
        var repos = files.ReadMap()["repos"]?.AsObject() ?? [];

        foreach (var (key, value) in repos)
        {
            var path = value?.ToString();

            if (path is not null && (Same(key, repo) || Same(Path.GetFileName(path.TrimEnd('/', '\\')), repo)))
                return path;
        }

        return null;
    }

    private static async Task<string?> HeadAsync(string root, string branch, CancellationToken cancellation)
    {
        var start = new ProcessStartInfo("git") { RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false, CreateNoWindow = true };

        foreach (var argument in new[] { "-C", root, "rev-parse", "--verify", "--quiet", $"refs/heads/{branch}" })
            start.ArgumentList.Add(argument);

        using var process = Process.Start(start) ?? throw new InvalidOperationException("git didn't start.");
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellation);

        timeout.CancelAfter(GitTimeout);

        var output = await process.StandardOutput.ReadToEndAsync(timeout.Token);

        await process.WaitForExitAsync(timeout.Token);

        return process.ExitCode == 0 && output.Trim().Length > 0 ? output.Trim() : null;
    }

    private static bool Same(string a, string b) => string.Equals(a, b, StringComparison.OrdinalIgnoreCase);

    // Passed to git as an argument: a value starting with '-' would be read as an option.
    [GeneratedRegex(@"^[A-Za-z0-9][A-Za-z0-9._/-]*$")]
    private static partial Regex BranchName();
}
