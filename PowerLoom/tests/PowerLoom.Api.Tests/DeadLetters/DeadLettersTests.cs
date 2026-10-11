using Alba;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Api.Tests.Probes;
using PowerLoom.Features.DeadLetters.Models;
using Wolverine;
using Wolverine.Persistence.Durability;

namespace PowerLoom.Api.Tests.DeadLetters;

[Collection(PowerLoomCollection.Name)]
public sealed class DeadLettersTests(PowerLoomHost host)
{
    [Fact]
    public async Task A_dead_letter_is_listed_with_its_error_and_can_be_replayed_or_discarded()
    {
        var discarded = await StoreDeadLetterAsync("discard-me");
        var replayed = await StoreDeadLetterAsync("replay-me");

        var listed = await host.Host.GetAsJson<List<DeadLetterInfo>>("/api/dead-letters?since=2026-01-01T00:00:00Z");
        var entry = listed!.Single(letter => letter.Id == discarded);

        Assert.Equal(("System.InvalidOperationException", "boom: discard-me", false), (entry.ExceptionType, entry.ExceptionMessage, entry.Replayable));
        Assert.Contains(listed!, letter => letter.Id == replayed);

        await host.Host.Scenario(scenario =>
        {
            scenario.Delete.Url($"/api/dead-letters/{discarded}");
            scenario.StatusCodeShouldBeOk();
        });
        await host.Host.Scenario(scenario =>
        {
            scenario.Post.Json(new { }).ToUrl($"/api/dead-letters/{replayed}/replay");
            scenario.StatusCodeShouldBeOk();
        });

        var after = await host.Host.GetAsJson<List<DeadLetterInfo>>("/api/dead-letters?since=2026-01-01T00:00:00Z");

        Assert.DoesNotContain(after!, letter => letter.Id == discarded);
        // Replayed: flagged for the durability agent, which puts it back on its queue (then it's gone from here).
        Assert.DoesNotContain(after!, letter => letter.Id == replayed && !letter.Replayable);
    }

    // What Wolverine does after the last retry: the envelope goes to the dead letter table with the exception.
    private async Task<Guid> StoreDeadLetterAsync(string marker)
    {
        var store = host.Host.Services.GetRequiredService<IMessageStore>();
        var envelope = new Envelope(new VaultProbe(PowerLoomHost.Vault, marker)) { Id = Guid.NewGuid(), MessageType = "vault-probe", Data = [], Destination = new Uri("local://vault") };

        await store.Inbox.MoveToDeadLetterStorageAsync(envelope, new InvalidOperationException($"boom: {marker}"));

        return envelope.Id;
    }
}
