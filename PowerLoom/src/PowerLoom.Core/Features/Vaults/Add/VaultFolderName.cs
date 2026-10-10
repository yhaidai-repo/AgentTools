using System.Text.RegularExpressions;
using PowerLoom.Contracts;

namespace PowerLoom.Features.Vaults.Add;

// A folder directly inside the vaults root: the name itself, or the folder's path on the PC.
public static partial class VaultFolderName
{
    public static Outcome<string> Parse(string input, string hostRoot)
    {
        var path = input.Trim().Replace('\\', '/').TrimEnd('/');
        var root = hostRoot.Replace('\\', '/').TrimEnd('/');
        var name = root.Length > 0 && path.StartsWith(root + "/", StringComparison.OrdinalIgnoreCase) ? path[(root.Length + 1)..] : path;

        if (!FolderName().IsMatch(name))
            return Outcome<string>.Failure(Problem.Invalid($"A vault is a folder directly inside {(root.Length > 0 ? root : "the vaults root")}."));

        return Outcome<string>.Success(name);
    }

    [GeneratedRegex("^[^\\\\/:*?\"<>|.][^\\\\/:*?\"<>|]*$")]
    private static partial Regex FolderName();
}
