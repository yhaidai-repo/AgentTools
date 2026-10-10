using System.Text.Json;
using Microsoft.Extensions.Options;
using PowerLoom.Contracts;
using PowerLoom.Contracts.Imports;
using PowerLoom.Persistence;

namespace PowerLoom.Features.ImportSources.Sources;

// Mails the Outlook exporter (tools/outlook-export) dumps into <inbox>/outlook (user decision 2026-10-02: classic
// Outlook on the PC, Inbox mails by subject). Each mail's work item links name its PBIs.
public sealed class OutlookMailSource(PowerLoomDbContext db, IOptions<ImportOptions> options) : FolderImportSource(db, options)
{
    public override string Id => "outlook";

    protected override string SubFolder => "outlook";

    protected override Outcome<PbiImportRequest> ToRequest(JsonElement content, string file)
    {
        var entryId = Text(content, "entryId");
        var html = Text(content, "html");
        var text = Text(content, "text");

        if (content.ValueKind != JsonValueKind.Object || entryId is null || (html is null && text is null))
            return Outcome<PbiImportRequest>.Failure(Problem.Invalid("Not an Outlook mail: entryId and html or text are required."));

        // The Internet Message-ID survives moves between folders; the entry id is the fallback. Checked like any request.
        var request = new { source = Id, sourceRef = Text(content, "internetMessageId") ?? entryId, title = Text(content, "subject"), from = Text(content, "sender"), occurredAt = Text(content, "received"), html, text };

        using var document = JsonDocument.Parse(JsonSerializer.Serialize(request));

        return ImportRequestParser.Parse(document.RootElement.Clone(), file);
    }

    private static string? Text(JsonElement value, string name)
    {
        if (value.ValueKind != JsonValueKind.Object || !value.TryGetProperty(name, out var property) || property.ValueKind != JsonValueKind.String)
            return null;

        return string.IsNullOrWhiteSpace(property.GetString()) ? null : property.GetString();
    }
}
