using System.Text;
using PowerLoom.Contracts;
using PowerLoom.Infrastructure.Attachments.Models;
using PowerLoom.Infrastructure.Text;

namespace PowerLoom.Infrastructure.Attachments;

// Converts an upload into the text agents read (null for an image). Every reason a file can't be used is returned,
// never swallowed.
public static class AttachmentText
{
    private static readonly Dictionary<string, Func<byte[], string>> Readers = new()
    {
        [".pdf"] = DocumentText.Pdf,
        [".docx"] = DocumentText.Docx,
        [".xlsx"] = DocumentText.Xlsx,
        [".csv"] = PlainText,
        [".html"] = bytes => HtmlMarkdown.Convert(PlainText(bytes)),
        [".htm"] = bytes => HtmlMarkdown.Convert(PlainText(bytes)),
        [".md"] = PlainText,
        [".markdown"] = PlainText,
        [".txt"] = PlainText,
    };

    public static Outcome<ExtractedText> Extract(UploadedFile file)
    {
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        var problem = Check(file, extension);

        if (problem is not null)
            return Outcome<ExtractedText>.Failure(Problem.Invalid(problem));

        if (AttachmentLimits.ImageExtensions.Contains(extension))
            return Outcome<ExtractedText>.Success(new ExtractedText(null));

        return Read(file, Readers[extension]);
    }

    private static string? Check(UploadedFile file, string extension)
    {
        if (file.Bytes.Length == 0)
            return $"{file.FileName} is empty.";

        if (file.Bytes.Length > AttachmentLimits.MaxBytes)
            return $"{file.FileName} is larger than {AttachmentLimits.MaxBytes / 1024 / 1024} MB.";

        return AttachmentLimits.AcceptedExtensions.Contains(extension) ? null : $"{file.FileName}: unsupported file type. Use {string.Join(", ", AttachmentLimits.AcceptedExtensions)}.";
    }

    private static Outcome<ExtractedText> Read(UploadedFile file, Func<byte[], string> reader)
    {
        try
        {
            var text = reader(file.Bytes).Trim();

            return text.Length == 0
                ? Outcome<ExtractedText>.Failure(Problem.Invalid($"{file.FileName} has no readable text (a scanned PDF or an empty document?)."))
                : Outcome<ExtractedText>.Success(new ExtractedText(text));
        }
        catch (Exception error) when (error is not OutOfMemoryException)
        {
            return Outcome<ExtractedText>.Failure(Problem.Invalid($"{file.FileName} could not be read: {error.Message}"));
        }
    }

    // Strict UTF-8: a binary file renamed to .txt is rejected instead of being stored as garbage.
    private static string PlainText(byte[] bytes) => new UTF8Encoding(false, throwOnInvalidBytes: true).GetString(bytes);
}
