using Microsoft.EntityFrameworkCore;
using PowerLoom.Features.Pbis.Notes.Models;
using PowerLoom.Infrastructure.Backlog;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Features.Pbis.Notes;

// Shared by Prepare and the render after a change, so a PBI note always looks the same whichever path wrote it.
public sealed class PbiNoteWriter(PowerLoomDbContext db, BacklogFiles files, IWorkItemLinks links)
{
    private static readonly KebabCaseNameTranslator Labels = new();

    // Writes the note and the PBI's uploads, stores the note's path; returns the path.
    public async Task<string> WritePbiAsync(WorkItem row, PipelineStatus status, CancellationToken cancellation)
    {
        var vaultPath = row.VaultPath ?? BacklogPaths.PbiNotePath(row.AdoId, row.Title);
        var template = await files.ReadOrCreateAsync(row.Vault, BacklogPaths.PbiTemplatePath, PbiTemplate.Default, cancellation);
        var note = await ToNoteAsync(row, status, cancellation);
        var regions = await PipelineRegions.BuildAsync(db, row.AdoId, cancellation);

        await files.WriteNoteAsync(row.Vault, vaultPath, notesSection => PbiNoteRenderer.Render(template, note, notesSection, regions), cancellation);
        await db.WorkItems.Where(item => item.AdoId == row.AdoId).ExecuteUpdateAsync(set => set.SetProperty(item => item.VaultPath, vaultPath), cancellation);
        await VaultAttachments.WriteFilesAsync(db, files, row.Vault, vaultPath, row.AdoId, cancellation);

        return vaultPath;
    }

    public async Task WriteIndexAsync(string vault, CancellationToken cancellation)
    {
        var rows = await db.WorkItems.AsNoTracking()
            .Where(row => row.Vault == vault && row.VaultPath != null)
            .OrderBy(row => row.BacklogPriority).ThenBy(row => row.AdoId)
            .Select(row => new { row.AdoId, row.Title, row.AdoState, row.PipelineStatus, row.IterationPath })
            .ToListAsync(cancellation);
        var index = rows.Select(row => new IndexRow(row.AdoId, row.Title, row.AdoState, Labels.TranslateMemberName(row.PipelineStatus.ToString()), row.IterationPath)).ToList();

        await files.WriteNoteAsync(vault, BacklogPaths.IndexPath, notesSection => BacklogIndexRenderer.Render(index, notesSection), cancellation);
    }

    private async Task<PbiNote> ToNoteAsync(WorkItem row, PipelineStatus status, CancellationToken cancellation)
    {
        var tags = row.Tags is null ? [] : row.Tags.Split(';', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);

        return new PbiNote(
            row.AdoId,
            row.Title,
            row.Type,
            row.AdoState,
            await links.WorkItemUrlAsync(row.Vault, row.AdoId, row.Source, cancellation) ?? "",
            Labels.TranslateMemberName(status.ToString()),
            row.IterationPath,
            row.AreaPath,
            row.AssignedTo,
            row.Priority,
            tags,
            row.DescriptionMd,
            row.AcceptanceCriteriaMd,
            row.ParentId,
            row.CreatedAt,
            row.AdoChangedAt ?? row.SyncedAt);
    }
}
