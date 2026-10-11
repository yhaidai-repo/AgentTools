namespace PowerLoom.AdoIntegration.Client.Models;

public sealed record AdoDownload(string FileName, string ContentType, byte[] Bytes);
