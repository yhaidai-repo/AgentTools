using Microsoft.EntityFrameworkCore;
using PowerLoom.Features.Cleanup.Models;
using PowerLoom.Features.Pbis.Notes;
using PowerLoom.Infrastructure.Backlog;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.PullRequests;

namespace PowerLoom.Features.Cleanup.Cleaners;

// A PBI closed or done for longer than the buffer: its backlog folder (notes, tasks, research, attachments), its chat
// note and its pull requests' review notes move to the backlog's `.trash/`. The user's `## Notes` live only in the
// note file (UserNotesFile), so they are saved into work_item first; everything else is in the database already.
public sealed class ClosedPbiFoldersCleaner(PowerLoomDbContext db, BacklogFiles files, PbiNoteWriter notes) : IArtefactCleaner
{
    public const string StoreName = "closed-pbis";
    private const string ChatKind = "pbi";

    public string Store => StoreName;

    public async Task<CleanerResult> CleanAsync(CleanupContext context, CancellationToken cancellation)
    {
        var cutoff = context.CutoffOf(context.Settings.ClosedPbiDays);

        if (cutoff is null)
            return CleanerResult.Off;

        var actions = new List<CleanupAction>();

        foreach (var pbi in await DuePbisAsync(context.Vault, cutoff.Value, cancellation))
            actions.AddRange(await TrashAsync(context, pbi, cancellation));

        if (actions.Any(action => action.Deleted))
            await notes.WriteIndexAsync(context.Vault, cancellation);

        return new CleanerResult(actions);
    }

    // Closed or done since before the cutoff (the last status change to it, or ADO's change date for a PBI imported
    // closed), with a folder still in the backlog.
    private async Task<List<ClosedPbi>> DuePbisAsync(string vault, DateTimeOffset cutoff, CancellationToken cancellation)
    {
        var closed = await db.WorkItems.AsNoTracking()
            .Where(pbi => pbi.Vault == vault && pbi.VaultPath != null && (pbi.PipelineStatus == PipelineStatus.Done || pbi.PipelineStatus == PipelineStatus.Closed))
            .Select(pbi => new { pbi.AdoId, pbi.VaultPath, pbi.AdoChangedAt })
            .ToListAsync(cancellation);
        var ids = closed.Select(pbi => pbi.AdoId.ToString()).ToList();
        var closedAt = await db.StatusHistories.AsNoTracking()
            .Where(row => row.EntityKind == EntityKind.Pbi && ids.Contains(row.EntityId) && (row.ToStatus == "done" || row.ToStatus == "closed"))
            .GroupBy(row => row.EntityId)
            .Select(group => new { Id = group.Key, At = group.Max(row => row.At) })
            .ToDictionaryAsync(row => row.Id, row => row.At, cancellation);

        return closed
            .Select(pbi => new ClosedPbi(pbi.AdoId, pbi.VaultPath!, closedAt.TryGetValue(pbi.AdoId.ToString(), out var at) ? at : pbi.AdoChangedAt))
            .Where(pbi => pbi.ClosedAt is not null && pbi.ClosedAt < cutoff.UtcDateTime && Directory.Exists(files.PathOf(vault, BacklogPaths.FolderOf(pbi.VaultPath))))
            .OrderBy(pbi => pbi.AdoId)
            .ToList();
    }

    private async Task<IReadOnlyList<CleanupAction>> TrashAsync(CleanupContext context, ClosedPbi pbi, CancellationToken cancellation)
    {
        var paths = new List<string> { BacklogPaths.FolderOf(pbi.VaultPath), BacklogPaths.ChatNotePath(ChatKind, pbi.AdoId.ToString()) };

        paths.AddRange(await ReviewNotesAsync(context.Vault, pbi.AdoId, cancellation));

        if (!context.DryRun)
            await SaveUserNotesAsync(context.Vault, pbi, cancellation);

        return paths.Where(Exists(context.Vault)).Select(path => Trash(context, path)).ToList();
    }

    // The review notes of the pull requests that list the PBI (`work_item_ids`, a JSON list of ADO ids).
    private async Task<List<string>> ReviewNotesAsync(string vault, int adoId, CancellationToken cancellation)
    {
        var prIds = await db.PullRequests.AsNoTracking().Where(pr => pr.Vault == vault).Select(pr => new { pr.Id, pr.WorkItemIds }).ToListAsync(cancellation);

        return prIds.Where(pr => PullRequestWorkItems.Parse(pr.WorkItemIds).Contains(adoId)).Select(pr => $"reviews/{BacklogPaths.ReviewNoteName(pr.Id)}.md").ToList();
    }

    private async Task SaveUserNotesAsync(string vault, ClosedPbi pbi, CancellationToken cancellation)
    {
        var text = NotesSection.BodyOf(await files.ReadTextAsync(vault, pbi.VaultPath, cancellation));

        if (text.Length == 0)
            return;

        await db.WorkItems.Where(row => row.AdoId == pbi.AdoId).ExecuteUpdateAsync(set => set.SetProperty(row => row.UserNotesMd, text), cancellation);
    }

    private Func<string, bool> Exists(string vault) => path => Directory.Exists(files.PathOf(vault, path)) || File.Exists(files.PathOf(vault, path));

    private CleanupAction Trash(CleanupContext context, string path)
    {
        var absolute = files.PathOf(context.Vault, path);
        var bytes = Directory.Exists(absolute) ? StaleFiles.SizeOf(absolute) : new FileInfo(absolute).Length;

        if (context.DryRun)
            return CleanupAction.Planned(StoreName, path, bytes);

        try
        {
            files.MoveToTrash(context.Vault, path);

            return CleanupAction.Removed(StoreName, path, bytes);
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            return CleanupAction.Failed(StoreName, path, bytes, error.Message);
        }
    }
}
