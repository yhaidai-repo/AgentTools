using PowerLoom.ConfluenceIntegration.Features.Pages;
using PowerLoom.Contracts;
using Wolverine;

namespace PowerLoom.ConfluenceIntegration.Features.LoadPage;

public static class LoadConfluencePageHandler
{
    // The notes follow either way: the task asking for the content may have been closed.
    public static async Task Handle(LoadConfluencePage message, PageSync sync, IMessageBus bus, ILogger<LoadConfluencePage> logger, CancellationToken cancellation)
    {
        var copies = await sync.FetchedCopiesAsync(message.AdoId, message.Url, cancellation);
        var changed = await sync.SyncPageAsync(message.Vault, message.AdoId, message.Url, copies, cancellation);

        logger.LogInformation("confluence PBI-{AdoId} load {Url}: {Changed}", message.AdoId, message.Url, changed ? "changed" : "unchanged");
        await bus.PublishAsync(new PbiChanged(message.Vault, message.AdoId));
    }
}
