using Microsoft.EntityFrameworkCore;
using PowerLoom.Features.Pbis.Notes.Models;
using PowerLoom.Infrastructure.Backlog;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Features.Pbis.Notes;

// The one safe way to update the vault for a PBI: nothing but its database state is written (PowerLoom's publishPbi). Its
// agents' drafts first (a rejected one becomes a human task, which the notes then show), then its notes: refinement
// note, design note, item notes, the PBI note's regions and the index (unchanged files are skipped).
public sealed class PbiNotesRenderer(PowerLoomDbContext db, BacklogFiles files, PbiNoteWriter notes, DraftWriter drafts)
{
    private static readonly KebabCaseNameTranslator Labels = new();

    public async Task RenderAsync(int adoId, CancellationToken cancellation)
    {
        await drafts.WriteAsync(adoId, cancellation);

        var row = await db.WorkItems.AsNoTracking().SingleOrDefaultAsync(item => item.AdoId == adoId, cancellation);

        // A PBI gets its note only from "Prepare for refinement"; until then answers and uploads stay in the database.
        if (row?.VaultPath is null)
            return;

        var pbiPath = await notes.WritePbiAsync(row, row.PipelineStatus, cancellation);
        var attachments = await VaultAttachments.ListAsync(db, adoId, cancellation);

        await WriteRefinementAsync(row.Vault, pbiPath, adoId, cancellation);
        await WriteDesignAsync(row.Vault, pbiPath, adoId, cancellation);
        await WriteItemsAsync(row.Vault, pbiPath, adoId, attachments, cancellation);
        // The handoff note moved to the chat notes (chats/pbi-<id>.md, 2026-10-11): one from before is removed.
        files.Remove(row.Vault, BacklogPaths.ImplementNotePath(pbiPath, adoId));
        await notes.WriteIndexAsync(row.Vault, cancellation);
    }

    private async Task WriteRefinementAsync(string vault, string pbiPath, int adoId, CancellationToken cancellation)
    {
        var latest = await db.Refinements.AsNoTracking().Where(row => row.PbiId == adoId).OrderByDescending(row => row.Version).FirstOrDefaultAsync(cancellation);

        if (latest is null)
            return;

        var note = new RefinementNote(adoId, latest.Version, latest.RunId, latest.CreatedAt, latest.Summary,
            NoteJson.List<string>(latest.ScopeIn), NoteJson.List<string>(latest.ScopeOut), NoteJson.List<AcceptanceGap>(latest.AcGaps), NoteJson.List<string>(latest.Dependencies),
            NoteJson.List<RepoReason>(latest.Repos), NoteJson.List<string>(latest.Assumptions), NoteJson.List<RelevantDoc>(latest.RelevantDocs), NoteJson.List<string>(latest.DocsRead));

        await files.WriteNoteAsync(vault, BacklogPaths.RefinementNotePath(pbiPath, adoId), notesSection => RefinementNoteRenderer.Render(note, notesSection), cancellation);
    }

    private async Task WriteDesignAsync(string vault, string pbiPath, int adoId, CancellationToken cancellation)
    {
        var latest = await db.Designs.AsNoTracking().Where(row => row.PbiId == adoId).OrderByDescending(row => row.Version).FirstOrDefaultAsync(cancellation);

        if (latest is null)
            return;

        var note = new DesignNote(adoId, latest.Version, latest.RunId, latest.CreatedAt, latest.Approach,
            NoteJson.List<DesignAlternative>(latest.Alternatives), NoteJson.List<Domain.Pbis.Models.DesignPlanStep>(latest.Plan), NoteJson.List<DesignRisk>(latest.Risks), NoteJson.List<Domain.Pbis.Models.DesignTest>(latest.Tests),
            NoteJson.List<string>(latest.Assumptions), latest.EstHumanH, latest.EstAgentH, latest.Complexity, latest.Confidence, latest.EstimateBasis);

        await files.WriteNoteAsync(vault, BacklogPaths.DesignNotePath(pbiPath, adoId), notesSection => DesignNoteRenderer.Render(note, notesSection), cancellation);
    }

    private async Task WriteItemsAsync(string vault, string pbiPath, int adoId, IReadOnlyList<VaultAttachment> attachments, CancellationToken cancellation)
    {
        var items = await db.LocalItems.Where(item => item.PbiId == adoId).ToListAsync(cancellation);

        foreach (var item in items)
            await PublishItemAsync(vault, pbiPath, item, attachments.Where(entry => entry.ItemId == item.Id).Select(entry => entry.VaultName).ToList(), cancellation);

        await db.SaveChangesAsync(cancellation);
    }

    private async Task PublishItemAsync(string vault, string pbiPath, LocalItem item, IReadOnlyList<string> attachments, CancellationToken cancellation)
    {
        if (item.Status == ItemStatus.Deleted)
        {
            RemoveItemNote(vault, item);

            return;
        }

        await WriteItemAsync(vault, pbiPath, item, attachments, cancellation);
    }

    // A deleted item leaves the vault: its note goes, and the PBI note's table no longer lists it.
    private void RemoveItemNote(string vault, LocalItem item)
    {
        if (item.VaultPath is null)
            return;

        files.Remove(vault, item.VaultPath);
        item.VaultPath = null;
    }

    private async Task WriteItemAsync(string vault, string pbiPath, LocalItem item, IReadOnlyList<string> attachments, CancellationToken cancellation)
    {
        var path = item.VaultPath ?? BacklogPaths.ItemNotePath(pbiPath, item.Id, item.Kind);
        var note = new ItemNote(item.Id, item.Kind, item.PbiId ?? 0, item.ParentId, item.Title, Labels.TranslateMemberName(item.Status.ToString()), item.Assignee, item.Body, NoteJson.Element(item.Data), item.Resolution, attachments, item.CreatedByRun, item.CreatedAt, item.UpdatedAt);

        await files.WriteNoteAsync(vault, path, notesSection => ItemNoteRenderer.Render(note, notesSection), cancellation);
        item.VaultPath = path;
    }
}
