using PowerLoom.Contracts;

namespace PowerLoom.Infrastructure.Vaults;

// A path inside a vault: relative, forward slashes, no `..`.
public static class VaultPath
{
    public static Outcome<string> Parse(string path)
    {
        var relative = path.Replace('\\', '/').TrimStart('/');
        var escapes = relative.Split('/').Contains("..");

        if (relative.Length == 0 || escapes)
            return Outcome<string>.Failure(Problem.Invalid($"not a path inside the vault: {path}"));

        return Outcome<string>.Success(relative);
    }

    // For paths the code builds itself (a template's file name, a note path from the database), never user input.
    public static string Trusted(string path)
    {
        var parsed = Parse(path);

        return parsed.Ok ? parsed.Value : throw new ArgumentException(parsed.Problem.Detail, nameof(path));
    }
}
