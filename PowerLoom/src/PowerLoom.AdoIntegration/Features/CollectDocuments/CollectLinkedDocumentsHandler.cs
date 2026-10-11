using PowerLoom.Contracts.Documents;
using PowerLoom.Features.Tasks;
using PowerLoom.Persistence;
using Wolverine;

namespace PowerLoom.AdoIntegration.Features.CollectDocuments;

// On the vault's queue; the PBI's notes follow when a document or task was added.
public static class CollectLinkedDocumentsHandler
{
    private const string Actor = "documents";

    public static async Task Handle(CollectLinkedDocuments message, LinkedDocumentCollector collector, PowerLoomDbContext db, IMessageBus bus, ILogger<CollectLinkedDocuments> logger, CancellationToken cancellation)
    {
        var changed = await collector.CollectAsync(message.Vault, message.AdoId, cancellation);

        if (changed == 0)
            return;

        logger.LogInformation("documents PBI-{AdoId}: {Changed} linked document(s) collected or asked for", message.AdoId, changed);
        await PbiChanges.PublishAsync(db, bus, message.AdoId, Actor, cancellation);
    }
}
