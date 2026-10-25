namespace PowerLoom.Api.Tests.Probes;

// A git checkout's files as the backend reads them (no git needed): HEAD, loose branch refs and packed-refs.
public static class FakeCheckout
{
    public static string Create(string root, string folder, string currentBranch, Dictionary<string, string> looseHeads, Dictionary<string, string>? packedHeads = null)
    {
        var git = Path.Combine(root, folder, ".git");

        Directory.CreateDirectory(git);
        File.WriteAllText(Path.Combine(git, "HEAD"), $"ref: refs/heads/{currentBranch}\n");

        foreach (var (branch, sha) in looseHeads)
            WriteLoose(git, branch, sha);

        var packed = (packedHeads ?? []).Select(entry => $"{entry.Value} refs/heads/{entry.Key}");

        File.WriteAllLines(Path.Combine(git, "packed-refs"), ["# pack-refs with: peeled fully-peeled sorted", .. packed]);

        return Path.Combine(root, folder);
    }

    public static string Sha(char digit) => new(digit, 40);

    private static void WriteLoose(string git, string branch, string sha)
    {
        var path = Path.Combine([git, "refs", "heads", .. branch.Split('/')]);

        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllText(path, sha + "\n");
    }
}
