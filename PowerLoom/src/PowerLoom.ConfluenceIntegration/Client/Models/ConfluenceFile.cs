namespace PowerLoom.ConfluenceIntegration.Client.Models;

// A file attached to a Confluence page (not downloaded yet).
public sealed record ConfluenceFile(string Id, string FileName, string MediaType, long SizeBytes, string DownloadUrl);
