using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Features.Pbis.UserNotes.Models;
using PowerLoom.Infrastructure.Backlog;
using PowerLoom.Persistence;

namespace PowerLoom.Features.Pbis.UserNotes;

// The user's own notes on a PBI (user decision 2026-10-13): the `## Notes` section of its vault note, so Obsidian edits
// the same text and every agent that reads the note sees it.
public sealed class UserNotesFile(PowerLoomDbContext db, BacklogFiles files)
{
    public async Task<Outcome<PbiUserNotes>> ReadAsync(int adoId, CancellationToken cancellation)
    {
        var location = await LocateAsync(adoId, cancellation);

        if (!location.Ok)
            return Outcome<PbiUserNotes>.Failure(location.Problem);

        var note = await files.ReadTextAsync(location.Value.Vault, location.Value.Path, cancellation);

        return Outcome<PbiUserNotes>.Success(new PbiUserNotes(NotesSection.BodyOf(note)));
    }

    public async Task<Outcome<PbiUserNotes>> SaveAsync(int adoId, SaveUserNotesRequest request, CancellationToken cancellation)
    {
        var location = await LocateAsync(adoId, cancellation);

        if (!location.Ok)
            return Outcome<PbiUserNotes>.Failure(location.Problem);

        var note = await files.ReadTextAsync(location.Value.Vault, location.Value.Path, cancellation);
        var problem = SaveProblem(note, request);

        if (problem is not null)
            return Outcome<PbiUserNotes>.Failure(problem);

        await files.WriteTextAsync(location.Value.Vault, location.Value.Path, NotesSection.Replace(note!, request.Text), cancellation);

        return Outcome<PbiUserNotes>.Success(new PbiUserNotes(NotesSection.Clean(request.Text)));
    }

    // Never overwrite text the user hasn't seen: an Obsidian edit or another tab since the page loaded the notes.
    private static Problem? SaveProblem(string? note, SaveUserNotesRequest request)
    {
        if (note is null)
            return Problem.Conflict("The PBI note is missing in the vault: prepare the PBI again, then add your notes.");

        if (NotesSection.BodyOf(note) != NotesSection.Clean(request.LoadedText))
            return Problem.Conflict("Your notes changed in the vault since this page loaded them: reload, then save again.");

        return null;
    }

    private async Task<Outcome<PbiNoteLocation>> LocateAsync(int adoId, CancellationToken cancellation)
    {
        var pbi = await db.WorkItems.AsNoTracking().Where(row => row.AdoId == adoId).Select(row => new { row.Vault, row.VaultPath }).SingleOrDefaultAsync(cancellation);

        if (pbi is null)
            return Outcome<PbiNoteLocation>.Failure(Problem.NotFound($"PBI-{adoId} isn't in PowerLoom."));

        if (pbi.VaultPath is null)
            return Outcome<PbiNoteLocation>.Failure(Problem.Conflict($"PBI-{adoId} has no vault note yet: prepare it first."));

        return Outcome<PbiNoteLocation>.Success(new PbiNoteLocation(pbi.Vault, pbi.VaultPath));
    }
}
