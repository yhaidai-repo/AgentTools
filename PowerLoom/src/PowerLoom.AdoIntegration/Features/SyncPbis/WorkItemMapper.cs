using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using PowerLoom.AdoIntegration.Client;
using PowerLoom.AdoIntegration.Client.Models;
using PowerLoom.AdoIntegration.Features.SyncPbis.Models;
using PowerLoom.Infrastructure.Text;

namespace PowerLoom.AdoIntegration.Features.SyncPbis;

public static class WorkItemMapper
{
    public static MappedWorkItem Map(AdoWorkItem item)
    {
        var fields = item.Fields;
        var title = Text(fields, AdoFields.Title) ?? "";
        var descriptionHtml = Text(fields, AdoFields.Description) ?? Text(fields, AdoFields.ReproSteps) ?? "";
        var acceptanceCriteriaHtml = Text(fields, AdoFields.AcceptanceCriteria) ?? "";

        return new MappedWorkItem(
            item.Id,
            item.Rev,
            Text(fields, AdoFields.Type) ?? "",
            title,
            Text(fields, AdoFields.State) ?? "",
            Text(fields, AdoFields.IterationPath),
            Text(fields, AdoFields.AreaPath),
            Identity(fields, AdoFields.AssignedTo),
            Int(fields, AdoFields.Priority),
            Number(fields, AdoFields.BacklogPriority),
            Decimal(fields, AdoFields.Effort),
            Decimal(fields, AdoFields.RemainingWork),
            Int(fields, AdoFields.Parent),
            Tags(Text(fields, AdoFields.Tags)),
            Date(Text(fields, AdoFields.ChangedDate)),
            HtmlMarkdown.Convert(descriptionHtml),
            HtmlMarkdown.Convert(acceptanceCriteriaHtml),
            ExtraTextFields.Render(fields),
            ContentHash(title, descriptionHtml, acceptanceCriteriaHtml));
    }

    // Staleness is driven by what agents read: title, description and acceptance criteria (the HTML as ADO sent it).
    private static string ContentHash(params string[] parts)
    {
        return Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(string.Join("\0", parts))));
    }

    private static string? Text(Dictionary<string, JsonElement> fields, string key)
    {
        return fields.TryGetValue(key, out var value) && value.ValueKind == JsonValueKind.String && value.GetString() is { Length: > 0 } text ? text : null;
    }

    private static double? Number(Dictionary<string, JsonElement> fields, string key)
    {
        return fields.TryGetValue(key, out var value) && value.ValueKind == JsonValueKind.Number ? value.GetDouble() : null;
    }

    private static int? Int(Dictionary<string, JsonElement> fields, string key) => Number(fields, key) is { } number ? (int)number : null;

    private static decimal? Decimal(Dictionary<string, JsonElement> fields, string key) => Number(fields, key) is { } number ? (decimal)number : null;

    private static string? Identity(Dictionary<string, JsonElement> fields, string key)
    {
        if (!fields.TryGetValue(key, out var value) || value.ValueKind != JsonValueKind.Object)
            return null;

        return value.TryGetProperty("uniqueName", out var unique) ? unique.GetString() : value.TryGetProperty("displayName", out var display) ? display.GetString() : null;
    }

    private static DateTime? Date(string? value) => value is null ? null : DateTime.Parse(value, null, System.Globalization.DateTimeStyles.AdjustToUniversal | System.Globalization.DateTimeStyles.AssumeUniversal);

    private static IReadOnlyList<string> Tags(string? tags) => tags is null ? [] : tags.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}
