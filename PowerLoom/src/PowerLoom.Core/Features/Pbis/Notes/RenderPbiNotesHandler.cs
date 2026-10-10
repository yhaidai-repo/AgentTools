using PowerLoom.Contracts;

namespace PowerLoom.Features.Pbis.Notes;

// On the vault's queue: one PBI's notes at a time per vault.
public static class RenderPbiNotesHandler
{
    public static async Task Handle(PbiChanged message, PbiNotesRenderer renderer, ILogger<PbiChanged> logger, CancellationToken cancellation)
    {
        await renderer.RenderAsync(message.AdoId, cancellation);
        logger.LogInformation("notes PBI-{AdoId} rendered", message.AdoId);
    }
}
