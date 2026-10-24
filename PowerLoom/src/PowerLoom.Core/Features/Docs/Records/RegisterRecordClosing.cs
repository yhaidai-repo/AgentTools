using System.Text.RegularExpressions;
using PowerLoom.Features.Docs.Records.Models;
using PowerLoom.Infrastructure.VaultScan;
using PowerLoom.Infrastructure.VaultScan.Models;

namespace PowerLoom.Features.Docs.Records;

// Closes one record of a register note the way the vault rules say (the same edit the vault review makes, ported from
// @powerloom/vault closeRecord). KI/OQ: `[RESOLVED]` in the heading, the new status in the metadata line, `Updated`
// bumped, a **Decision** block. WWW: `Status: resolved`, `Updated` bumped, the decision in `Resolution`, statistics
// recalculated.
public static partial class RegisterRecordClosing
{
    private static readonly string[] EmptyFields = ["", "–", "-"];

    public static string Close(string noteText, MaintenanceRecord record, RecordClosingEdit closing, DateOnly today)
    {
        var date = today.ToString("yyyy-MM-dd");

        if (record.Kind == MaintenanceRecords.Www)
            return WwwLog.WithStats(ReplaceFirst(noteText, record.Text, ClosedWwwRecord(record.Text, closing, date)));

        var eol = noteText.Contains("\r\n") ? "\r\n" : "\n";

        return ReplaceFirst(noteText, record.Text, ClosedRegisterRecord(record.Text, closing, date, eol));
    }

    private static string ClosedRegisterRecord(string text, RecordClosingEdit closing, string date, string eol)
    {
        var lines = text.Split(eol);
        var body = lines.Skip(1).ToList();
        var metadata = $"> **{closing.Status}**";
        var updated = MetadataLine().IsMatch(text)
            ? UpdatedDate().Replace(MetadataLine().Replace(string.Join(eol, body), metadata, 1), $"Updated {date}", 1)
            : WithMetadataLine(body, $"{metadata} · Updated {date}", eol);
        var decision = $"**Decision** ({closing.DecidedBy}): {closing.Decision}";

        // The blank line keeps the block out of a list the record ends with (Markdown would continue the last item).
        return string.Join(eol, NotResolvedHeading().Replace(lines[0], "## [RESOLVED] ", 1), updated, "", decision);
    }

    // A record without a metadata line gets one right under its title (the heading, or the older bold title line).
    private static string WithMetadataLine(List<string> body, string metadataLine, string eol)
    {
        var titleLines = body.Count > 0 && BoldTitle().IsMatch(body[0]) ? 1 : 0;

        return string.Join(eol, body.Take(titleLines).Append(metadataLine).Concat(body.Skip(titleLines)));
    }

    private static string ClosedWwwRecord(string text, RecordClosingEdit closing, string date)
    {
        var resolved = WwwStatus().Replace(text, "- Status: resolved", 1);
        var updated = WwwUpdated().Replace(resolved, match => $"{match.Groups[1].Value}{date}", 1);

        return WwwResolution().Replace(updated, match => $"- Resolution: {WithResolution(match.Groups[1].Value.Trim(), closing)}", 1);
    }

    private static string WithResolution(string current, RecordClosingEdit closing)
    {
        var added = $"{closing.Decision} ({closing.DecidedBy})";

        return EmptyFields.Contains(current) ? added : $"{current}; {added}";
    }

    private static string ReplaceFirst(string text, string old, string replacement)
    {
        var index = text.IndexOf(old, StringComparison.Ordinal);

        return index < 0 ? text : string.Concat(text.AsSpan(0, index), replacement, text.AsSpan(index + old.Length));
    }

    [GeneratedRegex(@"^## (?!\[RESOLVED\] )")]
    private static partial Regex NotResolvedHeading();

    [GeneratedRegex(@"^> \*\*\w+\*\*(?:\s*\([^)]*\))?", RegexOptions.Multiline)]
    private static partial Regex MetadataLine();

    [GeneratedRegex(@"Updated:? \d{4}-\d{2}-\d{2}")]
    private static partial Regex UpdatedDate();

    [GeneratedRegex(@"^\*\*.+\*\*\s*$")]
    private static partial Regex BoldTitle();

    [GeneratedRegex(@"^- Status:.*$", RegexOptions.Multiline)]
    private static partial Regex WwwStatus();

    [GeneratedRegex(@"^(- Created: [^·\r\n]*· Updated: ).*$", RegexOptions.Multiline)]
    private static partial Regex WwwUpdated();

    [GeneratedRegex(@"^- Resolution:[ \t]*(.*)$", RegexOptions.Multiline)]
    private static partial Regex WwwResolution();
}
