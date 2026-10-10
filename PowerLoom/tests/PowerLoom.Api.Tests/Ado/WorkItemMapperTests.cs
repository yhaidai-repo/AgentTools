using System.Text.Json;
using PowerLoom.AdoIntegration.Client.Models;
using PowerLoom.AdoIntegration.Features.SyncPbis;
using PowerLoom.AdoIntegration.Features.SyncPbis.Models;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Api.Tests.Ado;

public sealed class WorkItemMapperTests
{
    public static AdoWorkItem Item(int id, int rev, string fieldsJson) => new(id, rev, JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(fieldsJson)!);

    [Fact]
    public void Fields_are_mapped_and_rich_text_becomes_markdown()
    {
        var item = Item(7, 2, """{"System.WorkItemType":"Product Backlog Item","System.Title":"Faster sync","System.State":"Committed","System.IterationPath":"P\\S7","System.AssignedTo":{"uniqueName":"sam@x.io","displayName":"Sam"},"Microsoft.VSTS.Common.Priority":2,"Microsoft.VSTS.Scheduling.Effort":5,"System.Parent":31001,"System.Tags":"api; urgent","System.ChangedDate":"2026-10-01T10:00:00Z","System.Description":"<p>Hi <b>there</b></p><ul><li>one</li></ul>","Microsoft.VSTS.Common.AcceptanceCriteria":"plain text"}""");

        var mapped = WorkItemMapper.Map(item);

        Assert.Equal((7, 2, "Product Backlog Item", "Faster sync", "Committed", "sam@x.io", 2, 5m, 31001), (mapped.AdoId, mapped.Rev, mapped.Type, mapped.Title, mapped.AdoState, mapped.AssignedTo, mapped.Priority, mapped.Effort, mapped.AdoParentId));
        Assert.Equal(["api", "urgent"], mapped.Tags);
        Assert.Equal(new DateTime(2026, 10, 1, 10, 0, 0, DateTimeKind.Utc), mapped.AdoChangedAt);
        Assert.Equal("Hi **there**\n\n- one", mapped.DescriptionMd.Replace("\r\n", "\n"));
        Assert.Equal("plain text", mapped.AcceptanceCriteriaMd);
        Assert.Equal(64, mapped.ContentHash.Length);
    }

    [Fact]
    public void The_hash_follows_the_title_description_and_criteria_only()
    {
        var a = WorkItemMapper.Map(Item(1, 1, """{"System.Title":"t","System.Description":"d","System.State":"New"}"""));
        var b = WorkItemMapper.Map(Item(1, 2, """{"System.Title":"t","System.Description":"d","System.State":"Done"}"""));
        var c = WorkItemMapper.Map(Item(1, 3, """{"System.Title":"t","System.Description":"changed","System.State":"New"}"""));

        Assert.Equal(a.ContentHash, b.ContentHash);
        Assert.NotEqual(a.ContentHash, c.ContentHash);
    }

    [Theory]
    [InlineData(PipelineStatus.Refining, "Committed", true, PipelineStatus.Stale)]
    [InlineData(PipelineStatus.New, "Committed", true, PipelineStatus.New)]
    [InlineData(PipelineStatus.Done, "Committed", true, PipelineStatus.Done)]
    [InlineData(PipelineStatus.Refining, "Done", false, PipelineStatus.Closed)]
    [InlineData(PipelineStatus.Closed, "Committed", false, PipelineStatus.New)]
    [InlineData(PipelineStatus.Refining, "Committed", false, PipelineStatus.Refining)]
    public void The_sync_owns_only_the_closed_reopened_and_stale_transitions(PipelineStatus current, string adoState, bool changed, PipelineStatus expected)
    {
        Assert.Equal(expected, PipelineStatusRule.Next(current, adoState, changed));
    }

    [Fact]
    public void A_window_takes_the_ids_after_the_cursor_up_to_the_cap()
    {
        var middle = SyncWindow.Select([10, 20, 30, 40, 50], 20, 2);
        var last = SyncWindow.Select([10, 20, 30, 40, 50], 40, 2);
        var empty = SyncWindow.Select([], 0, 2);

        Assert.Equal([30, 40], middle.Ids);
        Assert.Equal(40, middle.NextCursor);
        Assert.Equal([50], last.Ids);
        Assert.Equal(0, last.NextCursor);
        Assert.Empty(empty.Ids);
        Assert.Equal(0, empty.NextCursor);
    }
}
