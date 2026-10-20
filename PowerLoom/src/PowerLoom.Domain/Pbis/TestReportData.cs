using System.Text.Json;

namespace PowerLoom.Domain.Pbis;

// What the pipeline reads from a test report's data (the Autotest agent's `report`): whether a case failed.
public static class TestReportData
{
    public static bool HasFailedCase(string? data)
    {
        if (string.IsNullOrWhiteSpace(data))
            return false;

        try
        {
            using var document = JsonDocument.Parse(data);

            return Results(document.RootElement).Any(result => result.TryGetProperty("verdict", out var verdict) && verdict.ValueEquals("fail"));
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private static IEnumerable<JsonElement> Results(JsonElement root)
    {
        if (!root.TryGetProperty("report", out var report) || !report.TryGetProperty("results", out var results) || results.ValueKind != JsonValueKind.Array)
            return [];

        return results.EnumerateArray().ToList();
    }
}
