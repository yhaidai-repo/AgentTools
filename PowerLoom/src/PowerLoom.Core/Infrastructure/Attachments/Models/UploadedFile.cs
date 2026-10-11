namespace PowerLoom.Infrastructure.Attachments.Models;

public sealed record UploadedFile(string FileName, string ContentType, byte[] Bytes);
