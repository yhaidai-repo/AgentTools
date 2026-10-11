namespace PowerLoom.ConfluenceIntegration.Client.Models;

// A Confluence page as adoa reads it: its rendered body (HTML) and version.
public sealed record ConfluencePage(string Id, string Title, int Version, string Html);
