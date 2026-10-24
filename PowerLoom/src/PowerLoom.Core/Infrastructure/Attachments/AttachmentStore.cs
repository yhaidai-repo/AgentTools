using PowerLoom.Contracts;
using PowerLoom.Infrastructure.Attachments.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;

namespace PowerLoom.Infrastructure.Attachments;

// Converts and stores uploads (user decision 2026-10-09: several at once): every file is converted first, and when one
// can't be used none is stored, so the user fixes the selection and sends it again. Returns the new ids in the files'
// order. Stored in Postgres (bytes and extracted text), so the nightly backup includes them.
public static class AttachmentStore
{
    public static async Task<Outcome<List<int>>> StoreAsync(PowerLoomDbContext db, IReadOnlyList<UploadedFile> files, AttachmentTarget target, CancellationToken cancellation)
    {
        var extracted = files.Select(file => (File: file, Text: AttachmentText.Extract(file))).ToList();
        var problems = extracted.Where(entry => !entry.Text.Ok).Select(entry => entry.Text.Problem!.Detail).ToList();

        if (problems.Count > 0)
            return Outcome<List<int>>.Failure(Problem.Invalid(string.Join(" ", problems.Prepend(files.Count > 1 ? "Nothing was uploaded." : "").Where(part => part.Length > 0))));

        var rows = extracted.Select(entry => Row(entry.File, entry.Text.Value!.Text, target)).ToList();

        db.Attachments.AddRange(rows);
        await db.SaveChangesAsync(cancellation);

        return Outcome<List<int>>.Success(rows.Select(row => row.Id).ToList());
    }

    private static Attachment Row(UploadedFile file, string? text, AttachmentTarget target)
    {
        return new Attachment
        {
            PbiId = target.AdoId,
            ItemId = target.ItemId,
            SourceUrl = target.SourceUrl,
            Origin = target.Origin,
            SourceVersion = target.SourceVersion,
            FileName = file.FileName,
            ContentType = string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType,
            SizeBytes = file.Bytes.Length,
            Content = file.Bytes,
            Text = text,
        };
    }
}
