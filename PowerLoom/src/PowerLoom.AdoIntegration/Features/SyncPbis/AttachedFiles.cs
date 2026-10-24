using System.Text.Json;
using PowerLoom.AdoIntegration.Client.Models;

namespace PowerLoom.AdoIntegration.Features.SyncPbis;

// The files attached to a work item in ADO (its Attachments tab), as download links; the linked document collector
// stores them as the PBI's attachments (user decision 2026-10-15).
public static class AttachedFiles
{
    private const string AttachedFileRel = "AttachedFile";

    // The file name goes into the link, as in links pasted into a description: the download takes its name from there.
    public static IReadOnlyList<string> Urls(IReadOnlyList<AdoWorkItemRelation>? relations)
    {
        return (relations ?? []).Where(relation => relation.Rel == AttachedFileRel).Select(Url).ToList();
    }

    private static string Url(AdoWorkItemRelation relation)
    {
        var name = relation.Attributes?.GetValueOrDefault("name") is { ValueKind: JsonValueKind.String } value ? value.GetString() : null;

        return name is null ? relation.Url : $"{relation.Url}?fileName={Uri.EscapeDataString(name)}";
    }
}
