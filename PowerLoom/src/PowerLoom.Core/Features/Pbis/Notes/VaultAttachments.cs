using Microsoft.EntityFrameworkCore;
using PowerLoom.Features.Pbis.Notes.Models;
using PowerLoom.Infrastructure.Backlog;
using PowerLoom.Persistence;

namespace PowerLoom.Features.Pbis.Notes;

public static class VaultAttachments
{
    public static async Task<IReadOnlyList<VaultAttachment>> ListAsync(PowerLoomDbContext db, int adoId, CancellationToken cancellation)
    {
        var rows = await db.Attachments.AsNoTracking().Where(row => row.PbiId == adoId).OrderBy(row => row.Id).Select(row => new { row.Id, row.FileName, row.ItemId, row.SourceUrl }).ToListAsync(cancellation);

        return rows.Select(row => new VaultAttachment(row.Id, row.FileName, row.ItemId, row.SourceUrl, BacklogPaths.AttachmentRef(row.Id), BacklogPaths.AttachmentFileName(BacklogPaths.AttachmentRef(row.Id), row.FileName))).ToList();
    }

    // Copies uploads not yet in the vault into the PBI's attachments/ folder.
    public static async Task WriteFilesAsync(PowerLoomDbContext db, BacklogFiles files, string vault, string pbiPath, int adoId, CancellationToken cancellation)
    {
        var pending = await db.Attachments.Where(row => row.PbiId == adoId && row.VaultPath == null).ToListAsync(cancellation);

        foreach (var row in pending)
        {
            var path = BacklogPaths.AttachmentPath(pbiPath, BacklogPaths.AttachmentRef(row.Id), row.FileName);

            await files.WriteOnceAsync(vault, path, row.Content, cancellation);
            row.VaultPath = path;
        }

        await db.SaveChangesAsync(cancellation);
    }
}
