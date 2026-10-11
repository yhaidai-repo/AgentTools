using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Features.Pbis.Attachments.Models;
using PowerLoom.Features.Tasks;
using PowerLoom.Infrastructure.Attachments;
using PowerLoom.Infrastructure.Attachments.Models;
using PowerLoom.Infrastructure.Backlog;
using PowerLoom.Infrastructure.Http;
using PowerLoom.Persistence;
using Wolverine;
using Wolverine.Http;

namespace PowerLoom.Features.Pbis.Attachments;

// Uploads for a PBI (one or more files, user decision 2026-10-09), optionally for the item they answer (`itemId`) and
// the linked document they replace (`sourceUrl`): converted and stored, or refused with the reason and nothing stored.
public static class AttachmentsEndpoint
{
    private const string Actor = "human";

    [WolverinePost("/api/pbis/{adoId}/attachments")]
    public static async Task<Results<Ok<StoredAttachments>, ProblemHttpResult>> Post(int adoId, IFormFileCollection files, [FromForm] string? itemId, [FromForm] string? sourceUrl, PowerLoomDbContext db, IMessageBus bus, CancellationToken cancellation)
    {
        if (files.Count == 0)
            return Problem.Invalid("Choose, paste or drop a file.").ToProblemResult();

        if (!await db.WorkItems.AnyAsync(row => row.AdoId == adoId, cancellation))
            return Problem.NotFound($"PBI-{adoId} isn't in adoa.").ToProblemResult();

        var uploads = new List<UploadedFile>();

        foreach (var file in files)
            uploads.Add(await ReadAsync(file, cancellation));

        var stored = await AttachmentStore.StoreAsync(db, uploads, new AttachmentTarget(adoId, Text(itemId), Text(sourceUrl)), cancellation);

        if (!stored.Ok)
            return stored.Problem!.ToProblemResult();

        await PbiChanges.PublishAsync(db, bus, adoId, Actor, cancellation);

        return TypedResults.Ok(new StoredAttachments(stored.Value!, stored.Value!.Select(BacklogPaths.AttachmentRef).ToList()));
    }

    private static async Task<UploadedFile> ReadAsync(IFormFile file, CancellationToken cancellation)
    {
        using var stream = new MemoryStream();

        await file.CopyToAsync(stream, cancellation);

        return new UploadedFile(Path.GetFileName(file.FileName), file.ContentType, stream.ToArray());
    }

    private static string? Text(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
