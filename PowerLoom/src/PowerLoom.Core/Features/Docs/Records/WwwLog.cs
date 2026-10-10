using System.Text.RegularExpressions;
using PowerLoom.Features.Docs.Records.Models;

namespace PowerLoom.Features.Docs.Records;

// A vault's www-log.md: records appended with the next free id (never reused) and the statistics block recalculated,
// as the www-record skill does. The "Record format" sample (`## WWW-nnn`) isn't a record.
public static partial class WwwLog
{
    private const string Empty = "–";

    public static (string Text, string RecordId) Append(string logText, WwwEntry entry, DateOnly today)
    {
        var recordId = $"WWW-{LastRecordNumber(logText) + 1:000}";
        var text = $"{logText.TrimEnd()}\n\n{RenderRecord(recordId, entry, today)}\n";

        return (WithStats(text), recordId);
    }

    public static string WithStats(string text)
    {
        var records = RecordSplit().Split(text).Skip(1).ToList();
        var applied = records.Count(record => IsFilled(Field(record, "Applied at")));
        var withPrevention = records.Count(record => IsFilled(Field(record, "Preventive action")));
        var rows = new (string Metric, int Count)[]
        {
            ("Not as planned (total records)", records.Count),
            ("Fault: Human", CountField(records, "Fault", "Human")),
            ("Fault: Agent", CountField(records, "Fault", "Agent")),
            ("Status: open", CountField(records, "Status", "open")),
            ("Status: resolved", CountField(records, "Status", "resolved")),
            ("Preventive action applied", applied),
            ("Preventive action proposed, not applied", withPrevention - applied),
        };
        var table = string.Join("\n", new[] { "| Metric | Count |", "|---|---|" }.Concat(rows.Select(row => $"| {row.Metric} | {row.Count} |")));

        return StatsBlock().Replace(text, $"<!-- stats:start -->\n{table}\n<!-- stats:end -->", 1);
    }

    private static int LastRecordNumber(string logText)
    {
        var numbers = RecordHeading().Matches(logText).Select(match => int.Parse(match.Groups[1].Value));

        return numbers.DefaultIfEmpty(0).Max();
    }

    private static string RenderRecord(string recordId, WwwEntry entry, DateOnly today)
    {
        var date = today.ToString("yyyy-MM-dd");
        var lines = new[]
        {
            $"## {recordId} {entry.Title}",
            $"- Created: {date} · Updated: {date}",
            $"- Kind: {entry.Kind}",
            $"- Project: {entry.Project}",
            $"- Planned: {OneLine(entry.Planned)}",
            $"- Happened: {OneLine(entry.Happened)}",
            $"- Fault: {entry.Fault}",
            $"- Root cause: {OrEmpty(entry.RootCause)}",
            $"- Resolution: {OrEmpty(entry.Resolution)}",
            $"- Preventive action: {OrEmpty(entry.PreventiveAction)}",
            $"- Applied at: {Empty}",
            $"- Status: {(string.IsNullOrWhiteSpace(entry.Resolution) ? "open" : "resolved")}",
            $"- Assumptions: {(string.IsNullOrWhiteSpace(entry.Assumptions) ? "none" : OneLine(entry.Assumptions))}",
        };

        return string.Join("\n", lines);
    }

    private static string Field(string record, string name)
    {
        var match = Regex.Match(record, $"^- {Regex.Escape(name)}:\\s*(.+)$", RegexOptions.Multiline);

        return match.Success ? match.Groups[1].Value.Trim() : "";
    }

    private static int CountField(IEnumerable<string> records, string name, string value)
    {
        return records.Count(record => string.Equals(Field(record, name), value, StringComparison.OrdinalIgnoreCase));
    }

    private static bool IsFilled(string value) => value is not ("" or Empty or "-");

    private static string OrEmpty(string? value) => string.IsNullOrWhiteSpace(value) ? Empty : OneLine(value);

    // A record field is one list line.
    private static string OneLine(string value) => LineBreaks().Replace(value.Trim(), " ");

    [GeneratedRegex(@"^## WWW-(\d+)\b", RegexOptions.Multiline)]
    private static partial Regex RecordHeading();

    [GeneratedRegex(@"^## WWW-\d+", RegexOptions.Multiline)]
    private static partial Regex RecordSplit();

    [GeneratedRegex(@"<!-- stats:start -->[\s\S]*?<!-- stats:end -->")]
    private static partial Regex StatsBlock();

    [GeneratedRegex(@"\s*\r?\n\s*")]
    private static partial Regex LineBreaks();
}
