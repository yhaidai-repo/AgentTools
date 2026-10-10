using PowerLoom.Contracts;
using PowerLoom.Infrastructure.Vaults;

namespace PowerLoom.Features.Vaults.Trash;

// Only paths inside `.trash/`: a vault path, with the trash's own message.
public static class TrashPath
{
    public static Outcome<string> Parse(string path)
    {
        var parsed = VaultPath.Parse(path);

        return parsed.Ok ? parsed : Outcome<string>.Failure(Problem.Invalid($"not a path inside the trash: {path}"));
    }
}
