namespace PowerLoom.Features.Status.Telemetry;

public sealed record TelemetryPage<T>(string State, string? Message, IReadOnlyList<T> Items, bool Truncated, int Scanned);
public sealed record TelemetryLog(DateTime At, string Service, string Severity, string? TraceId, string? SpanId, string Body, IReadOnlyDictionary<string, string> Attributes);
public sealed record TelemetrySpan(string TraceId, string SpanId, string? ParentSpanId, string Service, string Name, DateTime At, double DurationMs, bool HasError, string? StatusMessage, IReadOnlyDictionary<string, string> Attributes, IReadOnlyList<TelemetryEvent> Events);
public sealed record TelemetryEvent(string Name, DateTime At, IReadOnlyDictionary<string, string> Attributes);
public sealed record TelemetryTrace(string TraceId, string Name, DateTime At, double DurationMs, bool HasError, int SpanCount, IReadOnlyList<string> Services);
