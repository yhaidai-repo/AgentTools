using System.Text.Json;
using PowerLoom.Contracts;
using PowerLoom.Contracts.Imports;

namespace PowerLoom.Features.ImportSources;

// A request from outside (an import inbox file): checked field by field, because any tool may write it. A file without
// a sourceRef uses its file name.
public static class ImportRequestParser
{
    public static Outcome<PbiImportRequest> Parse(JsonElement value, string? fallbackRef)
    {
        if (value.ValueKind != JsonValueKind.Object)
            return Outcome<PbiImportRequest>.Failure(Problem.Invalid("The request isn't a JSON object."));

        var request = new PbiImportRequest(
            Text(value, "source") ?? "",
            Text(value, "sourceRef") ?? fallbackRef ?? "",
            Text(value, "title"),
            Text(value, "from"),
            Text(value, "occurredAt"),
            Ids(value),
            Text(value, "html"),
            Text(value, "text"),
            value.TryGetProperty("prepare", out var prepare) ? prepare.ValueKind == JsonValueKind.True : null);
        var problem = ProblemOf(request, value);

        return problem is null ? Outcome<PbiImportRequest>.Success(request) : Outcome<PbiImportRequest>.Failure(Problem.Invalid(problem));
    }

    private static string? ProblemOf(PbiImportRequest request, JsonElement value)
    {
        if (request.Source.Length == 0 || request.SourceRef.Length == 0)
            return "source and sourceRef are required.";

        if (value.TryGetProperty("adoIds", out var ids) && ids.ValueKind == JsonValueKind.Array && ids.EnumerateArray().Any(id => !IsPositiveInteger(id)))
            return "adoIds must be whole numbers above 0.";

        if (request.OccurredAt is not null && !DateTimeOffset.TryParse(request.OccurredAt, null, System.Globalization.DateTimeStyles.AssumeUniversal, out _))
            return "occurredAt isn't a date.";

        var namesPbis = request.AdoIds is { Count: > 0 } || request.Html is not null || request.Text is not null;

        return namesPbis ? null : "Give adoIds, html or text.";
    }

    private static bool IsPositiveInteger(JsonElement id) => id.ValueKind == JsonValueKind.Number && id.TryGetInt32(out var number) && number > 0;

    private static IReadOnlyList<int>? Ids(JsonElement value)
    {
        if (!value.TryGetProperty("adoIds", out var ids) || ids.ValueKind != JsonValueKind.Array)
            return null;

        return ids.EnumerateArray().Where(IsPositiveInteger).Select(id => id.GetInt32()).ToList();
    }

    private static string? Text(JsonElement value, string name)
    {
        if (!value.TryGetProperty(name, out var property) || property.ValueKind != JsonValueKind.String)
            return null;

        var text = property.GetString()?.Trim();

        return string.IsNullOrEmpty(text) ? null : text;
    }
}
