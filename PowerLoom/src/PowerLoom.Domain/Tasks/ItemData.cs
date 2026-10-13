using System.Text.Json;

namespace PowerLoom.Domain.Tasks;

// Reads lists the agent-runner stores in an item's `data` (jsonb), e.g. `rerunAfter` and `dependsOn`.
public static class ItemData
{
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
