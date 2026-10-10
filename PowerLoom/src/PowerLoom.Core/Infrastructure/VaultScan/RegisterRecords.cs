using System.Text.RegularExpressions;
using PowerLoom.Infrastructure.VaultScan.Models;

namespace PowerLoom.Infrastructure.VaultScan;

// The records of a register note. Both layouts are read: the title in the heading (`## [RESOLVED] OQ-001 Title`), and
// the older one with the title as a bold line under `## OQ-001`. The same layouts VaultCapture's `register` reads.
public static partial class RegisterRecords
{
    private const string OpenStatus = "open";

    public static IReadOnlyList<RegisterRecord> Parse(string noteText)
    {
        var headings = Heading().Matches(noteText);

        return headings.Select((heading, index) => ToRecord(heading, noteText[(heading.Index + heading.Length)..(index + 1 < headings.Count ? headings[index + 1].Index : noteText.Length)])).ToList();
    }

    private static RegisterRecord ToRecord(Match heading, string body)
    {
        var statusMatch = MetadataStatus().Match(body);
        var status = statusMatch.Success ? statusMatch.Groups[1].Value : "";
        var markedResolved = heading.Groups[1].Success;
        var title = heading.Groups[3].Value.Trim();
        var bold = BoldLine().Match(body);

        return new RegisterRecord(
            heading.Groups[2].Value,
            title.Length > 0 ? title : bold.Success ? bold.Groups[1].Value : "",
            status,
            markedResolved || (status.Length > 0 && !status.Equals(OpenStatus, StringComparison.OrdinalIgnoreCase)),
            DateAfter(body, "Created"),
            DateAfter(body, "Updated"));
    }

    private static string? DateAfter(string body, string label)
    {
        var match = Regex.Match(body, $@"{label}:? (\d{{4}}-\d{{2}}-\d{{2}})");

        return match.Success ? match.Groups[1].Value : null;
    }

    [GeneratedRegex(@"^## (\[RESOLVED\] )?([A-Z]+-\d+)\b[ \t]*(.*)$", RegexOptions.Multiline)]
    private static partial Regex Heading();

    [GeneratedRegex(@"^\*\*(.+)\*\*\s*$", RegexOptions.Multiline)]
    private static partial Regex BoldLine();

    [GeneratedRegex(@"^> \*\*(\w+)\*\*", RegexOptions.Multiline)]
    private static partial Regex MetadataStatus();
}
