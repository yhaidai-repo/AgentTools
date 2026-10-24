namespace PowerLoom.ConfluenceIntegration.Client.Models;

public sealed record DownloadedFile(string FileName, string ContentType, byte[] Bytes);
