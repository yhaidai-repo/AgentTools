using System.Text.RegularExpressions;

namespace PowerLoom.Domain.Pbis;

// A PBI as the user types it: its id (123, #123), a link to it in Azure DevOps (…/_workitems/edit/123,
// …/workitems/123, ?id=123) or in PowerLoom (/pbis/123).
public static class PbiReference
{
    private static readonly Regex[] Patterns = [new(@"^#?(\d+)$"), new(@"workitems/(?:edit/)?(\d+)", RegexOptions.IgnoreCase), new(@"/pbis/(\d+)"), new(@"[?&]id=(\d+)")];

    public static int? Parse(string text)
    {
        var value = text.Trim();
        var match = Patterns.Select(pattern => pattern.Match(value)).FirstOrDefault(match => match.Success);

        return match is null ? null : int.Parse(match.Groups[1].Value);
    }
}
