using Microsoft.EntityFrameworkCore;
using PowerLoom.Domain.Tasks;
using PowerLoom.Domain.Tasks.Models;
using PowerLoom.Infrastructure.VaultCapture;
using PowerLoom.Infrastructure.VaultCapture.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;

namespace PowerLoom.Features.Pbis.Notes;

// Saves the PBI's pending drafts through the VaultCapture module. None may stay pending: each ends written (it then
// blocks the other agents until merged), or rejected and handed to the user as a human task.
public sealed class DraftWriter(PowerLoomDbContext db, IVaultCapture vaultCapture, ILogger<DraftWriter> logger)
{
    private const string Pending = "pending";

    public async Task WriteAsync(int adoId, CancellationToken cancellation)
    {
        var pending = await db.VaultCaptures.Where(capture => capture.PbiId == adoId && capture.Status == Pending).ToListAsync(cancellation);

        if (pending.Count == 0)
            return;

        var vault = await db.WorkItems.AsNoTracking().Where(row => row.AdoId == adoId).Select(row => row.Vault).SingleOrDefaultAsync(cancellation)
            ?? throw new InvalidOperationException($"PBI-{adoId} has {pending.Count} vault draft(s) to write, but isn't in adoa");

        foreach (var capture in pending)
            await SaveDraftAsync(vault, capture, cancellation);
    }

    private async Task SaveDraftAsync(string vault, VaultCapture capture, CancellationToken cancellation)
    {
        var request = new DraftCapture(capture.Project, capture.Name, capture.Title,
            $"session finding: adoa {capture.ItemId ?? "agent"} run RUN-{capture.RunId} (PBI-{capture.PbiId})",
            capture.Target, NoteJson.List<string>(capture.Captured), NoteJson.List<string>(capture.Assumptions), NoteJson.List<string>(capture.ToFill));
        var result = await vaultCapture.CaptureDraftAsync(vault, request, cancellation);

        capture.Status = result.Mode;
        capture.Errors = NoteJson.Serialize(result.Errors);
        capture.FilePath = result.Ok ? result.Path : null;

        await db.SaveChangesAsync(cancellation);

        if (!result.Ok)
            await HandOverAsync(capture, result.Errors, cancellation);
    }

    // The draft will never be written, so the person gets a task (which blocks the agents) with the reasons and the
    // facts to save by hand.
    private async Task HandOverAsync(VaultCapture capture, IReadOnlyList<string> errors, CancellationToken cancellation)
    {
        var facts = string.Join("\n", NoteJson.List<string>(capture.Captured).Select(fact => $"- {fact}"));
        var reasons = string.Join("\n", errors.Select(error => $"- {error}"));
        var body = $"VaultCapture rejected the draft CAP-{capture.Id} (target {capture.Target}):\n{reasons}\n\nCaptured facts:\n{facts}\n\nSave them in the docs vault by hand (or decide they aren't needed), then close this task.";
        var data = NoteJson.Serialize(new { captureId = capture.Id, key = ItemKeys.DraftKey(capture.Id) });
        var taskId = await HumanTasks.CreateAsync(db, new NewHumanTask(capture.PbiId, $"Fix the rejected vault draft \"{capture.Name}\"", body, capture.RunId, data), cancellation);

        logger.LogError("VaultCapture rejected CAP-{CaptureId} ({Name}): {Errors}; handed to the user as {TaskId}", capture.Id, capture.Name, string.Join("; ", errors), taskId);
    }
}
