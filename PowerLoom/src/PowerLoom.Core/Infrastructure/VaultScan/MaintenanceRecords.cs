using System.Text.RegularExpressions;
using PowerLoom.Infrastructure.VaultScan.Models;

namespace PowerLoom.Infrastructure.VaultScan;

// The registers the vault review checks (user decision 2026-10-06): the vault's www-log.md and each project's
// `<key>/<key>-known-issues.md` and `<key>/<key>-open-questions.md`. Feature-local question files aren't registers.
public static partial class MaintenanceRecords
{
    public const string Www = "www";
    public const string Issues = "issues";
    public const string Questions = "questions";

    private const string WwwLogPath = "www-log.md";
    private const string OpenWwwStatus = "open";

    private static readonly (string Suffix, string Kind)[] ProjectRegisters = [("known-issues", Issues), ("open-questions", Questions)];

    public static string? RegisterKindOf(string path)
    {
        if (path == WwwLogPath)
            return Www;

        var parts = path.Split('/');

        if (parts.Length != 2)
            return null;

        return ProjectRegisters.Where(register => parts[1] == $"{parts[0]}-{register.Suffix}.md").Select(register => register.Kind).FirstOrDefault();
    }

    // Every record of a register note, in the note's order; no records for any other note.
    public static IReadOnlyList<MaintenanceRecord> Of(string path, string noteText)
    {
        var kind = RegisterKindOf(path);

        if (kind is null)
            return [];

        return RecordBlocks(noteText).Select(text => kind == Www ? WwwRecord(path, text) : RegisterRecord(kind, path, text)).ToList();
    }

    private static IEnumerable<string> RecordBlocks(string noteText) => RecordHeading().Matches(noteText).Select(heading => BlockFrom(noteText, heading.Index));

    // A record ends at the next `#`/`##` heading; `###` and deeper belong to it.
    private static string BlockFrom(string noteText, int start)
    {
        var bodyStart = noteText.IndexOf('\n', start) + 1;

        if (bodyStart == 0)
            return noteText[start..];

        var next = NextHeading().Match(noteText[bodyStart..]);

        return noteText[start..(next.Success ? bodyStart + next.Index : noteText.Length)].TrimEnd();
    }

    private static MaintenanceRecord WwwRecord(string path, string text)
    {
        var record = WwwRecords.Parse(text)[0];

        return new MaintenanceRecord(Www, path, record.Id, record.Title, record.Status, record.Status.Equals(OpenWwwStatus, StringComparison.OrdinalIgnoreCase), record.Updated.Length > 0 ? record.Updated : null, text);
    }

    private static MaintenanceRecord RegisterRecord(string kind, string path, string text)
    {
        var record = RegisterRecords.Parse(text)[0];

        return new MaintenanceRecord(kind, path, record.Id, record.Title, record.Status, !record.Resolved, record.Updated, text);
    }

    [GeneratedRegex(@"^## (?:\[RESOLVED\] )?[A-Z]+-\d+\b", RegexOptions.Multiline)]
    private static partial Regex RecordHeading();

    [GeneratedRegex(@"^#{1,2} ", RegexOptions.Multiline)]
    private static partial Regex NextHeading();
}
