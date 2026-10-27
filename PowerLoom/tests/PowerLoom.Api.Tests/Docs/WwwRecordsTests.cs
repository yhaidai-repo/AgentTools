using System.Net;
using Alba;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Features.Docs.Records.Models;
using PowerLoom.Persistence;
using Wolverine;
using Wolverine.Tracking;

namespace PowerLoom.Api.Tests.Docs;

// www_create through PowerLoom's API (user decision 2026-10-26: its own tables are written there only): the record is
// stored and appended to the vault's www-log.md.
[Collection(PowerLoomCollection.Name)]
public sealed class WwwRecordsTests(PowerLoomHost host)
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(30);
    private static readonly string Url = $"/api/vaults/{PowerLoomHost.Vault}/www-records";

    [Fact]
    public async Task A_created_record_is_stored_and_logged_and_a_bad_kind_is_refused()
    {
        await File.WriteAllTextAsync(Path.Combine(host.VaultRoot, "www-log.md"), WwwLogTests.EmptyLog);
        CreatedWwwRecord? created = null;

        await host.Host.Services.TrackActivity().Timeout(Timeout).ExecuteAndWaitAsync((Func<IMessageContext, Task>)(async _ => created = await host.Host.PostJson(Record("notice", "The chat noticed a stale note"), Url).Receive<CreatedWwwRecord>()));
        await host.Host.Scenario(scenario =>
        {
            scenario.Post.Json(Record("rant", "Not a kind")).ToUrl(Url);
            scenario.StatusCodeShouldBe(HttpStatusCode.BadRequest);
        });

        var id = created!.Id;
        using var scope = host.Host.Services.CreateScope();
        var row = await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().WwwRecords.AsNoTracking().SingleAsync(record => record.Id == id);

        Assert.Equal((PowerLoomHost.Vault, "notice", "chat:test"), (row.Vault, row.Kind, row.Source));
        Assert.Contains("The chat noticed a stale note", await File.ReadAllTextAsync(Path.Combine(host.VaultRoot, "www-log.md")));
    }

    private static CreateWwwRecordRequest Record(string kind, string title) => new(title, kind, "pos", "Notes stay current", "A note was stale", "Agent", null, null, null, null, "chat:test");
}
