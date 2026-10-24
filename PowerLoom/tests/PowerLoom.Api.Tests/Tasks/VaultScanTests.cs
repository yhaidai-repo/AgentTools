using PowerLoom.Infrastructure.VaultScan;

namespace PowerLoom.Api.Tests.Tasks;

public sealed class VaultScanTests
{
    [Fact]
    public void Wiki_links_are_read_outside_code_and_resolved_like_obsidian()
    {
        const string content = "See [[pvs-index|the index]] and [[pvs/pvs-rules.md#Top]].\n```\n[[not-a-link]]\n```\nInline `[[neither]]` but [[Gone]].";

        var links = WikiLinks.Parse("docs/a.md", content);
        var index = new VaultIndex("v", [new("docs/a.md", "a", "A", DateTime.UtcNow, content), new("pvs/pvs-index.md", "pvs-index", "Index", DateTime.UtcNow, ""), new("pvs/pvs-rules.md", "pvs-rules", "Rules", DateTime.UtcNow, "")], [], []);

        Assert.Equal(["pvs-index", "pvs/pvs-rules.md", "Gone"], links.Select(link => link.Target));
        Assert.Equal(("the index", "Top"), (links[0].Label, links[1].Heading));
        Assert.Equal("pvs/pvs-index.md", index.Resolve("PVS-Index"));
        Assert.Equal(["Gone"], index.DeadLinks().Select(link => link.Target));
        Assert.Single(index.LinksTo("pvs/pvs-rules.md"));
    }

    [Fact]
    public void Register_and_www_records_are_read_with_their_status()
    {
        const string register = "# Known issues\n\n## [RESOLVED] KI-001 Old one\n\n> **Resolved** · Created 2026-09-01 · Updated 2026-09-20\n\n## KI-002 Still here\n\n> **Open** · Created 2026-10-01\n\ntext\n";
        const string www = "# WWW\n\n## WWW-001 Missed a case\n\n- Created: 2026-10-02 · Updated: 2026-10-03\n- Kind: bug\n- Project: pvs\n- Fault: Agent\n- Status: open\n";

        var issues = MaintenanceRecords.Of("pvs/pvs-known-issues.md", register);
        var log = MaintenanceRecords.Of("www-log.md", www);

        Assert.Equal([("KI-001", false, "2026-09-20"), ("KI-002", true, null)], issues.Select(record => (record.Id, record.IsOpen, record.Updated)));
        Assert.Equal(("WWW-001", "Missed a case", true, "2026-10-03"), (log[0].Id, log[0].Title, log[0].IsOpen, log[0].Updated));
        Assert.Empty(MaintenanceRecords.Of("pvs/feature/pvs-questions.md", register));
        Assert.True(ProtectedNotes.IsProtectedNote("pvs/pvs-index.md"));
        Assert.False(ProtectedNotes.IsProtectedNote("pvs/topic/note.md"));
    }
}
