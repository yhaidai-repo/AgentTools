namespace PowerLoom.Persistence.Reviews;

// Git branch refs as ADO and the pull request rows hold them (`refs/heads/<branch>`), and their short names.
public static class BranchRefs
{
    public const string Prefix = "refs/heads/";

    public static string NameOf(string reference)
    {
        var trimmed = reference.Trim();

        return trimmed.StartsWith(Prefix, StringComparison.Ordinal) ? trimmed[Prefix.Length..] : trimmed;
    }

    public static string RefOf(string name) => Prefix + NameOf(name);
}
