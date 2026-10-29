using System.Text.Json;

namespace PowerLoom.Api.Tests.Status;

internal static class TelemetryPayload
{
    public const string TraceId = "1234567890abcdef1234567890abcdef";
    public const string RootId = "1111111111111111";
    public const string ChildId = "2222222222222222";

    // Synthetic OTLP, shaped like the actual standalone Aspire 13.6.2 response.
    public static string Spans(DateTime at) => JsonSerializer.Serialize(new { resourceSpans = new[] {
        Resource("PowerLoom", new[] { Span(at, RootId, "", "GET /inspection", 100, false) }),
        Resource("database", new[] { Span(at.AddMilliseconds(20), ChildId, RootId, "SELECT inspection", 60, true) })
    } });

    public static string Logs(DateTime at, string body = "inspection failed", int count = 1) => JsonSerializer.Serialize(new {
        resourceLogs = new[] { new { resource = Attributes("PowerLoom"), scopeLogs = new[] { new {
            logRecords = Enumerable.Range(0, count).Select(index => new {
                timeUnixNano = Nano(at.AddMinutes(-index)), severityNumber = 17, severityText = "Error",
                traceId = TraceId, spanId = RootId, body = new { stringValue = body + index }, attributes = new[] { new { key = "task.id", value = new { stringValue = "AT-PROBE-001" } } }
            }).ToArray()
        } } } }
    });

    public static string Envelope(string data, int total = 1, int? returned = null) => "{\"data\":" + data + ",\"totalCount\":" + total + ",\"returnedCount\":" + (returned ?? total) + "}";
    private static object Resource(string service, object spans) => new { resource = Attributes(service), scopeSpans = new[] { new { spans } } };
    private static object Attributes(string service) => new { attributes = new[] { new { key = "service.name", value = new { stringValue = service } } } };
    private static string Nano(DateTime at) => ((at.Ticks - DateTime.UnixEpoch.Ticks) * 100).ToString(System.Globalization.CultureInfo.InvariantCulture);
    private static object Span(DateTime at, string id, string parent, string name, int duration, bool error) => new {
        traceId = TraceId, spanId = id, parentSpanId = parent, name, startTimeUnixNano = Nano(at), endTimeUnixNano = Nano(at.AddMilliseconds(duration)),
        status = new { code = error ? 2 : 1, message = error ? "synthetic database error" : "" },
        attributes = new[] { new { key = "run.id", value = new { intValue = "1234" } } },
        events = error ? new[] { new { name = "exception", timeUnixNano = Nano(at), attributes = new[] { new { key = "exception.message", value = new { stringValue = "synthetic database error" } } } } } : []
    };
}
