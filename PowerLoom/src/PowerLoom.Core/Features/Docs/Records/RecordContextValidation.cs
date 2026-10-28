using Microsoft.EntityFrameworkCore;
using PowerLoom.Infrastructure.VaultScan;
using PowerLoom.Infrastructure.VaultScan.Models;
using PowerLoom.Persistence;

namespace PowerLoom.Features.Docs.Records;

public static class RecordContextValidation
{
    public static async Task<string?> ProblemAsync(RecordWorkContext? context, string vault, PowerLoomDbContext db, CancellationToken cancellation)
    {
        if (context is null) return null;
        if (context.PbiId is <= 0 || !RecordWorkReferences.ValidId(context.TaskId) || !RecordWorkReferences.ValidId(context.ChatId) || !RecordWorkReferences.ValidId(context.SessionId))
            return "Record context needs positive PBI ids and single-line task/chat/session ids (at most 200 characters).";
        if (context.PbiId is { } pbi && !await db.WorkItems.AnyAsync(row => row.AdoId == pbi && row.Vault == vault, cancellation))
            return "The context PBI is not in this vault.";
        if (context.TaskId is { } task)
        {
            var row = await db.LocalItems.AsNoTracking().SingleOrDefaultAsync(item => item.Id == task && item.Vault == vault, cancellation);
            if (row is null) return "The context task is not in this vault.";
            if (context.PbiId is { } parent && row.PbiId is { } taskPbi && parent != taskPbi) return "The context task belongs to another PBI.";
        }
        return null;
    }
}
