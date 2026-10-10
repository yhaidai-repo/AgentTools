using System.Text.Json;

namespace PowerLoom.Features.Pbis.Notes;

// The JSON columns of refinements, designs, items and drafts, as the TypeScript side wrote them (camelCase).
public static class NoteJson
{
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);

    public static IReadOnlyList<T> List<T>(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return [];

        return JsonSerializer.Deserialize<List<T>>(json, Options) ?? [];
    }

    public static JsonElement? Element(string? json) => string.IsNullOrWhiteSpace(json) ? null : JsonDocument.Parse(json).RootElement.Clone();

    public static string Serialize<T>(T value) => JsonSerializer.Serialize(value, Options);
}
