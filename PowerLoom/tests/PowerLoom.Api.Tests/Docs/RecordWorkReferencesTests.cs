using PowerLoom.Infrastructure.VaultScan;
using PowerLoom.Infrastructure.VaultScan.Models;

namespace PowerLoom.Api.Tests.Docs;

public sealed class RecordWorkReferencesTests
{
    [Fact]
    public void Line_UsesKnownWorkItemsAndActualChatBeforeSession()
    {
        var line = RecordWorkReferences.Line("Created", new RecordWorkContext(7, "TT-7-001", "codex-123", "mcp-456"), new DateOnly(2026, 10, 29));
        Assert.Equal("- Created in: 2026-10-29 · pbi:7 · task:TT-7-001 · chat:codex-123", line);
    }

    [Theory]
    [InlineData(null, true)]
    [InlineData("local_123-ab", true)]
    [InlineData("chat\n## KI-999 Fake", false)]
    [InlineData("[chat](javascript:alert)", false)]
    public void ValidId_RejectsMarkdownAndLineBreaks(string? id, bool valid) => Assert.Equal(valid, RecordWorkReferences.ValidId(id));

    [Fact]
    public void AppendUpdate_PreservesCreationAndDoesNotRepeatTheSameOrigin()
    {
        const string created = "## KI-001 Wrong total\r\n- Created in: 2026-10-01 · task:WT-001";
        var context = new RecordWorkContext(SessionId: "mcp-456");
        var date = new DateOnly(2026, 10, 29);
        var updated = RecordWorkReferences.AppendUpdate(created, context, date, "\r\n");
        Assert.Contains(created, updated);
        Assert.EndsWith("\r\n- Updated in: 2026-10-29 · session:mcp-456", updated);
        Assert.Equal(updated, RecordWorkReferences.AppendUpdate(updated, context, date, "\r\n"));
    }
}
