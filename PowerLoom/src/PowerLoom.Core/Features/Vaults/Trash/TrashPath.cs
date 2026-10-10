using PowerLoom.Contracts;

namespace PowerLoom.Features.Vaults.Trash;

// Only paths inside `.trash/`: relative, forward slashes, no `..`.
public static class TrashPath
{
    public static Outcome<string> Parse(string path)
    {
        var relative = path.Replace('\\', '/').TrimStart('/');
        var escapes = relative.Split('/').Contains("..");

        if (relative.Length == 0 || escapes)
            return Outcome<string>.Failure(Problem.Invalid($"not a path inside the trash: {path}"));

        return Outcome<string>.Success(relative);
    }
}
