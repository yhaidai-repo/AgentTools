using PowerLoom.Domain.Pbis;
using PowerLoom.Domain.Tasks;
using PowerLoom.Domain.Tasks.Models;
using PowerLoom.Infrastructure.VaultCapture;
using PowerLoom.Infrastructure.VaultCapture.Models;
using PowerLoom.Persistence;

namespace PowerLoom.Features.Drafts;

// Every draft of the vault gets a tech-writer task (adoa's drafts first, then oldest first, so the tasks queue up the
// same way); a task whose draft is gone is done, and a capture whose draft is gone is merged.
public static class ScanVaultDraftsHandler
{
    private const string AdoaSource = "session finding: adoa";

    public static async Task Handle(ScanVaultDrafts message, PowerLoomDbContext db, IVaultCapture capture, ILogger<ScanVaultDrafts> logger, CancellationToken cancellation)
    {
        var drafts = await capture.ListDraftsAsync(message.Vault, AdoaSource, cancellation);
        var created = 0;

        foreach (var draft in drafts)
            created += await DraftTasks.CreateIfMissingAsync(db, message.Vault, ToTask(draft), cancellation) is null ? 0 : 1;

        var waiting = await DraftTasks.WaitingAsync(db, message.Vault, cancellation);
        var written = await VaultCaptures.WrittenNamesAsync(db, message.Vault, cancellation);
        var stillDrafts = await capture.IsDraftAsync(message.Vault, waiting.Select(DraftTasks.DraftNameOf).Concat(written).Distinct().ToList(), cancellation);
        var closed = await DraftTasks.CloseGoneAsync(db, waiting, stillDrafts, cancellation);
        var merged = await VaultCaptures.MarkMergedAsync(db, message.Vault, stillDrafts, cancellation);

        logger.LogInformation("drafts {Vault}: {Drafts} draft(s), {Created} task(s) created, {Closed} closed (draft gone), {Merged} capture(s) merged", message.Vault, drafts.Count, created, closed, merged);
    }

    private static NewDraftTask ToTask(VaultDraft draft) => new(draft.Name, draft.Title, draft.Project, draft.Captured, draft.Source, draft.Target, draft.Path);
}
