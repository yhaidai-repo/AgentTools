using PowerLoom.Features.Docs.Records;
using PowerLoom.Features.Docs.Records.Models;

namespace PowerLoom.Api.Tests.Docs;

public sealed class WwwLogTests
{
    private static readonly DateOnly Today = new(2026, 10, 11);

    public const string EmptyLog = """
        # What-went-wrong (WWW) log

        ## Statistics
        <!-- stats:start -->
        | Metric | Count |
        |---|---|
        | Not as planned (total records) | 0 |
        <!-- stats:end -->

        ## Record format
        ```
        ## WWW-nnn Short title
        - Fault: Human | Agent
        ```

        ## Records
        """;

    private static readonly WwwEntry Entry = new("Sync skipped a PBI", "complaint", "adoa", "Every sprint PBI synced", "One was\nskipped", "Agent", null, null, null, null);

    [Fact]
    public void The_first_record_gets_WWW_001_and_the_statistics()
    {
        var (text, recordId) = WwwLog.Append(EmptyLog, Entry, Today);

        Assert.Equal("WWW-001", recordId);
        Assert.Contains("## WWW-001 Sync skipped a PBI\n- Created: 2026-10-11 · Updated: 2026-10-11\n- Kind: complaint", text);
        Assert.Contains("- Happened: One was skipped\n", text);
        Assert.Contains("- Status: open\n- Assumptions: none\n", text);
        Assert.Contains("| Not as planned (total records) | 1 |\n| Fault: Human | 0 |\n| Fault: Agent | 1 |\n| Status: open | 1 |", text);
    }

    [Fact]
    public void Ids_continue_after_the_last_record_and_resolved_records_count()
    {
        var (first, _) = WwwLog.Append(EmptyLog, Entry, Today);
        var (text, recordId) = WwwLog.Append(first, Entry with { Fault = "Human", Resolution = "Fixed", PreventiveAction = "A test" }, Today);

        Assert.Equal("WWW-002", recordId);
        Assert.Contains("| Not as planned (total records) | 2 |\n| Fault: Human | 1 |\n| Fault: Agent | 1 |\n| Status: open | 1 |\n| Status: resolved | 1 |\n| Preventive action applied | 0 |\n| Preventive action proposed, not applied | 1 |", text);
    }
}
