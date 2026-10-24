using System.Text.RegularExpressions;
using PowerLoom.Infrastructure.VaultScan.Models;

namespace PowerLoom.Infrastructure.VaultScan;

// Every record of a www-log.md, in the log's order. The "Record format" sample (`## WWW-nnn`) isn't a record.
public static partial class WwwRecords
{
    public static IReadOnlyList<WwwRecordInfo> Parse(string logText)
    {
        var headings = Heading().Matches(logText);

        return headings.Select((heading, index) => ToRecord(heading, logText[heading.Index..(index + 1 < headings.Count ? headings[index + 1].Index : logText.Length)])).ToList();
    }

    private static WwwRecordInfo ToRecord(Match heading, string record)
    {
        var dates = Field(record, "Created").Split('·').Select(part => part.Replace("Updated:", "").Trim()).ToList();

        return new WwwRecordInfo(
            heading.Groups[1].Value,
            heading.Groups[2].Value.Trim(),
            dates.ElementAtOrDefault(0) ?? "",
            dates.ElementAtOrDefault(1) ?? dates.ElementAtOrDefault(0) ?? "",
            Field(record, "Kind"),
            Field(record, "Project"),
            Field(record, "Fault"),
            Field(record, "Status"));
    }

    // `- Label: value` lines of a record.
    private static string Field(string record, string label)
    {
        var match = Regex.Match(record, $@"^- {label}:\s*(.+)$", RegexOptions.Multiline);

        return match.Success ? match.Groups[1].Value.Trim() : "";
    }

    [GeneratedRegex(@"^## (WWW-\d+)\b[ \t]*(.*)$", RegexOptions.Multiline)]
    private static partial Regex Heading();
}
