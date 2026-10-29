using Microsoft.AspNetCore.Mvc;
using Wolverine.Http;

namespace PowerLoom.Features.Status.Telemetry;

public static class TelemetryEndpoints
{
    [WolverineGet("/api/status/telemetry/logs")]
    public static Task<TelemetryPage<TelemetryLog>> Logs([FromServices] AspireTelemetryReader reader, int? hours, string? resource, string? severity, string? traceId, string? search, int? limit, CancellationToken cancellation)
        => reader.Logs(hours ?? 1, resource, severity, traceId, search, limit ?? 25, cancellation);

    [WolverineGet("/api/status/telemetry/traces")]
    public static Task<TelemetryPage<TelemetryTrace>> Traces([FromServices] AspireTelemetryReader reader, int? hours, string? resource, bool? errorsOnly, double? minDurationMs, string? search, int? limit, CancellationToken cancellation)
        => reader.Traces(hours ?? 1, resource, errorsOnly ?? false, minDurationMs ?? 0, search, limit ?? 20, cancellation);

    [WolverineGet("/api/status/telemetry/traces/{traceId}")]
    public static Task<TelemetryPage<TelemetrySpan>> Trace(string traceId, [FromServices] AspireTelemetryReader reader, int? limit, CancellationToken cancellation)
        => reader.Trace(traceId, limit ?? 100, cancellation);
}
