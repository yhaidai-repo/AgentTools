using PowerLoom.Features.Docs.Records;
using PowerLoom.Features.Docs.Records.Models;
using PowerLoom.Infrastructure.VaultScan;

namespace PowerLoom.Api.Tests.Docs;

public sealed class RegisterRecordClosingTests
{
    private const string IssuesPath = "pvs/pvs-known-issues.md";
    private static readonly DateOnly Today = new(2026, 10, 24);
    private static readonly RecordClosingEdit Fixed = new("Fixed", "the user in a chat, 2026-10-24", "Fixed by PBI-38519, the retry handles the timeout.");

    [Fact]
    public void A_known_issue_gets_RESOLVED_its_status_and_a_Decision_block_and_the_other_records_stay()
    {
        const string register = "# Known issues\n\n## KI-001 Sync drops a page\n\n> **Open** · Created 2026-10-01 · Updated 2026-10-02\n\nThe last page is lost.\n\n## KI-002 Still here\n\n> **Open** · Created 2026-10-03\n\ntext\n";
        var record = MaintenanceRecords.Of(IssuesPath, register).Single(candidate => candidate.Id == "KI-001");

        var closed = RegisterRecordClosing.Close(register, record, Fixed, Today);

        Assert.Contains("## [RESOLVED] KI-001 Sync drops a page\n\n> **Fixed** · Created 2026-10-01 · Updated 2026-10-24\n\nThe last page is lost.\n\n**Decision** (the user in a chat, 2026-10-24): Fixed by PBI-38519, the retry handles the timeout.", closed);
        Assert.Contains("## KI-002 Still here\n\n> **Open** · Created 2026-10-03", closed);
    }

    [Fact]
    public void A_record_without_a_metadata_line_gets_one_under_its_title()
    {
        const string register = "# Open questions\n\n## OQ-003\n**Which rate applies?**\nAsk finance.\n";
        var record = MaintenanceRecords.Of("pvs/pvs-open-questions.md", register).Single();

        var closed = RegisterRecordClosing.Close(register, record, Fixed with { Status = "Resolved" }, Today);

        Assert.Contains("## [RESOLVED] OQ-003\n**Which rate applies?**\n> **Resolved** · Updated 2026-10-24\nAsk finance.", closed);
    }

    [Fact]
    public void A_WWW_record_is_resolved_with_the_decision_in_its_Resolution_and_the_statistics_follow()
    {
        var (log, _) = WwwLog.Append(WwwLogTests.EmptyLog, new WwwEntry("Sync skipped a PBI", "complaint", "PowerLoom", "Every PBI", "One skipped", "Agent", null, null, null, null), new DateOnly(2026, 10, 11));
        var record = MaintenanceRecords.Of("www-log.md", log).Single();

        var closed = RegisterRecordClosing.Close(log, record, new RecordClosingEdit("Resolved", "the user in a chat, 2026-10-24", "The sync pages now."), Today);

        Assert.Contains("- Created: 2026-10-11 · Updated: 2026-10-24", closed);
        Assert.Contains("- Status: resolved", closed);
        Assert.Contains("- Resolution: The sync pages now. (the user in a chat, 2026-10-24)", closed);
        Assert.Contains("| Status: resolved | 1 |", closed);
    }
}
