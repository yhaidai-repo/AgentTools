using PowerLoom.Contracts;
using PowerLoom.Features.Pbis.Notes;
using PowerLoom.Infrastructure.Backlog;

namespace PowerLoom.Features.Pbis.Delete;

// The deleted PBI's folder in the backlog vault goes, and the index is written without it.
public static class PbiDeletedHandler
{
    public static async Task Handle(PbiDeleted message, BacklogFiles files, PbiNoteWriter notes, ILogger<PbiDeleted> logger, CancellationToken cancellation)
    {
        if (message.VaultPath is null)
            return;

        files.RemoveFolder(message.Vault, BacklogPaths.FolderOf(message.VaultPath));
        await notes.WriteIndexAsync(message.Vault, cancellation);
        logger.LogInformation("notes PBI-{AdoId} removed", message.AdoId);
    }
}
