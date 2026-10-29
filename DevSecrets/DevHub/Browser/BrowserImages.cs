using System.Text.RegularExpressions;
using DevSecrets.DevHub.Models;
namespace DevSecrets.DevHub.Browser;
public static partial class BrowserImages
{
    public sealed record Image(string Base64);
    public static HubResult<Image> Read(string root, string owner, string caseName, string file)
    {
        if (!Segment().IsMatch(owner) || !Segment().IsMatch(caseName) || !FileName().IsMatch(file))
            return HubResult<Image>.From(HubResult.Invalid("Use owner/case and a PNG filename; paths are not accepted."));
        var folder = Path.GetFullPath(Path.Combine(root, owner, caseName));
        var path = Path.Combine(folder, file);
        if (!File.Exists(path)) return HubResult<Image>.From(HubResult.NotFound("Screenshot not found; save it with a simple filename in the case output directory."));
        for (var part = new DirectoryInfo(folder); part is not null; part = part.Parent)
        {
            if ((part.Attributes & FileAttributes.ReparsePoint) != 0) return HubResult<Image>.From(HubResult.Invalid("Image folders must not be links."));
            if (string.Equals(part.FullName, Path.GetFullPath(root), StringComparison.OrdinalIgnoreCase)) break;
        }
        var info = new FileInfo(path);
        if ((info.Attributes & FileAttributes.ReparsePoint) != 0 || info.Length > 2 * 1024 * 1024)
            return HubResult<Image>.From(HubResult.Invalid("Use a regular PNG no larger than 2 MB."));
        var content = File.ReadAllBytes(path);
        if (content.Length < 24 || !content.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }))
            return HubResult<Image>.From(HubResult.Invalid("Not a PNG screenshot."));
        return HubResult<Image>.Ok(new Image(Convert.ToBase64String(content)));
    }
    [GeneratedRegex("^[A-Za-z0-9][A-Za-z0-9_-]*$")] private static partial Regex Segment();
    [GeneratedRegex("^[A-Za-z0-9][A-Za-z0-9_-]*[.]png$")] private static partial Regex FileName();
}
