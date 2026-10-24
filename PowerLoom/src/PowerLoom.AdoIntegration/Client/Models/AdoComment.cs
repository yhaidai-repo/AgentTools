namespace PowerLoom.AdoIntegration.Client.Models;

// One comment of a work item's discussion; the text is HTML as ADO stores it.
public sealed record AdoComment(string? Author, DateTime? CreatedAt, string TextHtml);
