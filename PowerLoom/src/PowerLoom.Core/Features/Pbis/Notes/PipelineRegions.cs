using Microsoft.EntityFrameworkCore;
using PowerLoom.Infrastructure.Backlog;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Features.Pbis.Notes;

// Content of the PBI note's generated regions, built from the database so every render shows the current state.
public static class PipelineRegions
{
    private static readonly KebabCaseNameTranslator Labels = new();

    // Every state but merged (and rejected, which is a human task instead) blocks the other agents.
    private static readonly Dictionary<string, string> DraftStates = new()
    {
        ["pending"] = "not written yet: blocks the other agents",
        ["created"] = "waiting to be verified and merged: blocks the other agents",
        ["appended"] = "waiting to be verified and merged: blocks the other agents",
        ["merged"] = "merged",
    };

    public static async Task<IReadOnlyDictionary<string, string>> BuildAsync(PowerLoomDbContext db, int adoId, CancellationToken cancellation)
    {
        return new Dictionary<string, string>
        {
            ["refinement"] = await RefinementRegionAsync(db, adoId, cancellation),
            ["items"] = await ItemsRegionAsync(db, adoId, cancellation),
        };
    }

    private static async Task<string> RefinementRegionAsync(PowerLoomDbContext db, int adoId, CancellationToken cancellation)
    {
        var latest = await db.Refinements.AsNoTracking().Where(row => row.PbiId == adoId).OrderByDescending(row => row.Version).FirstOrDefaultAsync(cancellation);

        if (latest is null)
            return "Pending.";

        var parts = new List<string> { $"{latest.Summary}\n\nDetails: [[{BacklogPaths.RefinementNoteName(adoId)}]] (v{latest.Version})" };
        var estimate = await PbiEstimates.LatestAsync(db, adoId, cancellation);
        var design = await DesignLineAsync(db, adoId, cancellation);

        if (estimate is not null)
            parts.Add($"Estimate: {PbiEstimates.Text(estimate)}");

        if (design is not null)
            parts.Add(design);

        return string.Join("\n\n", parts);
    }

    // The design shares the refinement region, so the user's PBI template needs no new region.
    private static async Task<string?> DesignLineAsync(PowerLoomDbContext db, int adoId, CancellationToken cancellation)
    {
        var latest = await db.Designs.AsNoTracking().Where(row => row.PbiId == adoId).OrderByDescending(row => row.Version).FirstOrDefaultAsync(cancellation);

        if (latest is null)
            return null;

        return $"Design: [[{BacklogPaths.DesignNoteName(adoId)}]] (v{latest.Version}).";
    }

    // The items table, then the user's uploads and the agents' vault drafts (kept in this region so the user's PBI
    // template needs no change).
    private static async Task<string> ItemsRegionAsync(PowerLoomDbContext db, int adoId, CancellationToken cancellation)
    {
        var parts = new List<string?> { await ItemsTableAsync(db, adoId, cancellation), await AttachmentsTableAsync(db, adoId, cancellation), await DraftsTableAsync(db, adoId, cancellation) };

        return string.Join("\n\n", parts.Where(part => part is not null));
    }

    private static async Task<string> ItemsTableAsync(PowerLoomDbContext db, int adoId, CancellationToken cancellation)
    {
        var items = await db.LocalItems.AsNoTracking().Where(item => item.PbiId == adoId && item.Status != ItemStatus.Deleted).OrderBy(item => item.Id).ToListAsync(cancellation);

        if (items.Count == 0)
            return "None yet.";

        var lines = items.Select(item => $"| [[{item.Id}]] | {item.Kind} | {Label(item.Status)} | {NoteText.EscapeCell(item.Title)} |");

        return string.Join("\n", new[] { "| Item | Kind | Status | Title |", "|---|---|---|---|" }.Concat(lines));
    }

    private static async Task<string?> AttachmentsTableAsync(PowerLoomDbContext db, int adoId, CancellationToken cancellation)
    {
        var attachments = await VaultAttachments.ListAsync(db, adoId, cancellation);

        if (attachments.Count == 0)
            return null;

        var lines = attachments.Select(entry => $"| [[{entry.VaultName}]] | {(entry.ItemId is null ? NoteText.Empty : $"[[{entry.ItemId}]]")} | {entry.SourceUrl ?? NoteText.Empty} |");

        return string.Join("\n", new[] { "**Attachments**", "", "| File | For | Content of |", "|---|---|---|" }.Concat(lines));
    }

    // Drafts live in the docs vault's draft/ folder; the backlog sits inside that vault, so [[name]] opens them.
    private static async Task<string?> DraftsTableAsync(PowerLoomDbContext db, int adoId, CancellationToken cancellation)
    {
        var drafts = await db.VaultCaptures.AsNoTracking().Where(draft => draft.PbiId == adoId).OrderBy(draft => draft.Id).ToListAsync(cancellation);

        if (drafts.Count == 0)
            return null;

        var lines = drafts.Select(draft => $"| {(IsInDraftFolder(draft) ? $"[[{draft.Name}]]" : draft.Name)} | {DraftState(draft)} | RUN-{draft.RunId} |");

        return string.Join("\n", new[] { "**Vault drafts**", "", "| Draft | State | Run |", "|---|---|---|" }.Concat(lines));
    }

    // A merged draft is gone from draft/ (its facts live in the target note), so only unmerged ones get a link.
    private static bool IsInDraftFolder(VaultCapture draft) => draft.Status is "created" or "appended";

    private static string DraftState(VaultCapture draft)
    {
        return DraftStates.TryGetValue(draft.Status, out var state) ? state : $"rejected: {NoteText.EscapeCell(string.Join("; ", NoteJson.List<string>(draft.Errors)))} (handed to you as a human task)";
    }

    private static string Label<T>(T value) where T : struct, Enum => Labels.TranslateMemberName(value.ToString());
}
