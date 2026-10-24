using System.Text.Json;

namespace PowerLoom.Domain.Tasks;

// Reads values the agent-runner stores in an item's `data` (jsonb), e.g. `rerunAfter`, `dependsOn`, `blocking`.
public static class ItemData
{
    public static bool? BoolOf(string? data, string property)
    {
        if (data is null)
            return null;

        using var document = JsonDocument.Parse(data);

        if (!document.RootElement.TryGetProperty(property, out var value))
            return null;

        return value.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            _ => null,
        };
    }

    public static string? StringOf(string? data, string property)
    {
        if (data is null)
            return null;

        using var document = JsonDocument.Parse(data);

        return document.RootElement.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;
    }

    public static List<string> StringsOf(string? data, string property)
    {
        if (data is null)
            return [];

        using var document = JsonDocument.Parse(data);

        if (!document.RootElement.TryGetProperty(property, out var values) || values.ValueKind != JsonValueKind.Array)
            return [];

        return values.EnumerateArray().Where(value => value.ValueKind == JsonValueKind.String).Select(value => value.GetString()!).ToList();
    }
}
