using System.Globalization;
using System.Text.Json;

namespace PowerLoom.Features.Status.Telemetry;

// Aspire's OTLP envelope stays internal. Inspection returns bounded summaries, not arbitrary telemetry payloads.
public static class OtlpInspection
{
    public static IEnumerable<TelemetryLog> Logs(JsonElement root)
    {
        foreach (var resource in ResourceArray(root, "resourceLogs"))
        foreach (var scope in Array(resource, "scopeLogs"))
        foreach (var log in Array(scope, "logRecords"))
            yield return new TelemetryLog(Time(log, "timeUnixNano", "observedTimeUnixNano"), Service(resource), Text(log, "severityText"), Id(log, "traceId", 16), Id(log, "spanId", 8), Clip(Any(Property(log, "body")), 2000), Attributes(log));
    }

    public static IEnumerable<TelemetrySpan> Spans(JsonElement root)
    {
        foreach (var resource in ResourceArray(root, "resourceSpans"))
        foreach (var scope in Array(resource, "scopeSpans"))
        foreach (var span in Array(scope, "spans"))
        {
            var trace = Id(span, "traceId", 16);
            var id = Id(span, "spanId", 8);
            if (trace is null || id is null) continue;
            var status = Property(span, "status");
            var code = Text(status, "code");
            var duration = Math.Max(0, Nano(span, "endTimeUnixNano") - Nano(span, "startTimeUnixNano")) / 1_000_000d;
            yield return new TelemetrySpan(trace, id, Id(span, "parentSpanId", 8), Service(resource), Clip(Text(span, "name"), 200), Time(span, "startTimeUnixNano"), duration,
                code is "2" or "STATUS_CODE_ERROR" or "Error", Clip(Text(status, "message"), 1000), Attributes(span),
                Array(span, "events").Take(3).Select(item => new TelemetryEvent(Clip(Text(item, "name"), 200), Time(item, "timeUnixNano"), Attributes(item))).ToList());
        }
    }

    public static IEnumerable<TelemetryTrace> Traces(IEnumerable<TelemetrySpan> spans) => spans.GroupBy(span => span.TraceId).Select(group =>
    {
        var ordered = group.OrderBy(span => span.At).ToList();
        var start = ordered[0].At;
        return new TelemetryTrace(group.Key, (ordered.Find(span => span.ParentSpanId is null) ?? ordered[0]).Name, start,
            Math.Max(0, ordered.Max(span => (span.At - start).TotalMilliseconds + span.DurationMs)), ordered.Any(span => span.HasError), ordered.Count, ordered.Select(span => span.Service).Distinct().ToList());
    });

    public static int Total(JsonElement root) => int.TryParse(Text(root, "totalCount"), out var count) ? count : 0;
    private static JsonElement Data(JsonElement root) => Property(root, "data").ValueKind == JsonValueKind.Object ? Property(root, "data") : root;
    private static IEnumerable<JsonElement> ResourceArray(JsonElement root, string name)
    {
        if (Property(Data(root), name).ValueKind != JsonValueKind.Array) throw new JsonException("Unrecognized diagnostics response.");
        return Array(Data(root), name);
    }
    private static JsonElement Property(JsonElement parent, string name) => parent.ValueKind == JsonValueKind.Object && parent.TryGetProperty(name, out var value) ? value : default;
    private static IEnumerable<JsonElement> Array(JsonElement parent, string name) => Property(parent, name).ValueKind == JsonValueKind.Array ? Property(parent, name).EnumerateArray() : [];
    private static string Text(JsonElement parent, string name) => Property(parent, name).ToString();
    private static long Nano(JsonElement parent, string name) => long.TryParse(Text(parent, name), CultureInfo.InvariantCulture, out var nano) ? nano : 0;
    private static DateTime Time(JsonElement parent, string name, string? fallback = null)
    {
        var nano = Nano(parent, name);
        if (nano == 0 && fallback is not null) nano = Nano(parent, fallback);
        return DateTime.UnixEpoch.AddTicks(Math.Max(0, nano) / 100);
    }
    private static string Service(JsonElement resource) => Array(Property(resource, "resource"), "attributes").Where(attr => Text(attr, "key") == "service.name").Select(attr => Clip(Any(Property(attr, "value")), 200)).FirstOrDefault() ?? "unknown";
    private static IReadOnlyDictionary<string, string> Attributes(JsonElement item) => Array(item, "attributes").Take(10).GroupBy(attr => Clip(Text(attr, "key"), 100)).ToDictionary(group => group.Key, group => Clip(Any(Property(group.Last(), "value")), 256));
    private static string Any(JsonElement value)
    {
        if (value.ValueKind != JsonValueKind.Object) return value.ToString();
        foreach (var name in new[] { "stringValue", "boolValue", "intValue", "doubleValue" })
            if (Property(value, name).ValueKind != JsonValueKind.Undefined) return Property(value, name).ToString();
        return value.ToString();
    }
    private static string Clip(string text, int max) => text.Length > max ? text[..max] + "…" : text;
    private static string? Id(JsonElement item, string name, int bytes)
    {
        var text = Text(item, name);
        if (text.Length == bytes * 2 && text.All(Uri.IsHexDigit) && text.Any(character => character != '0')) return text.ToLowerInvariant();
        try { var decoded = Convert.FromBase64String(text); return decoded.Length == bytes && decoded.Any(value => value != 0) ? Convert.ToHexStringLower(decoded) : null; }
        catch (FormatException) { return null; }
    }
}
