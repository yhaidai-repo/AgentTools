using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.WebUtilities;

namespace PowerLoom.Features.Status.Telemetry;

public sealed class AspireTelemetryReader(IHttpClientFactory clients, IConfiguration configuration, TimeProvider clock)
{
    public const string HttpClientName = "AspireInspection";
    private const int ScanLimit = 500;

    public Task<TelemetryPage<TelemetryLog>> Logs(int hours, string? resource, string? severity, string? traceId, string? search, int limit, CancellationToken cancellation)
    {
        if (!Valid(hours, limit, 100, resource, search) || severity is not (null or "Trace" or "Debug" or "Information" or "Warning" or "Error" or "Critical") || traceId is not null && !ValidTrace(traceId))
            return Task.FromResult(Failure<TelemetryLog>("invalid", "Invalid telemetry filters: hours 1–24, limit 1–100, resource/search at most 200 characters, severity Trace/Debug/Information/Warning/Error/Critical, traceId 32 nonzero hexadecimal digits."));
        return Read("logs", new() { ["resource"] = resource, ["severity"] = severity, ["traceId"] = traceId?.ToLowerInvariant(), ["limit"] = ScanLimit.ToString() }, root =>
        {
            var rows = OtlpInspection.Logs(root).ToList();
            var since = clock.GetUtcNow().UtcDateTime.AddHours(-hours);
            return Page(rows.Where(row => row.At >= since && Matches(row.Body, search)).OrderByDescending(row => row.At), limit, rows.Count, OtlpInspection.Total(root) > rows.Count);
        }, cancellation);
    }

    public Task<TelemetryPage<TelemetryTrace>> Traces(int hours, string? resource, bool errorsOnly, double minDurationMs, string? search, int limit, CancellationToken cancellation)
    {
        if (!Valid(hours, limit, 50, resource, search) || !double.IsFinite(minDurationMs) || minDurationMs < 0 || minDurationMs > 3_600_000)
            return Task.FromResult(Failure<TelemetryTrace>("invalid", "Invalid trace filters: hours 1–24, limit 1–50, minimum duration 0–3600000 ms, resource/search at most 200 characters."));
        return Read("traces", new() { ["resource"] = resource, ["hasError"] = errorsOnly ? "true" : null, ["limit"] = "100" }, root =>
        {
            var rows = OtlpInspection.Traces(OtlpInspection.Spans(root)).ToList();
            var since = clock.GetUtcNow().UtcDateTime.AddHours(-hours);
            return Page(rows.Where(row => row.At >= since && row.DurationMs >= minDurationMs && (!errorsOnly || row.HasError) && Matches(row.Name, search)).OrderByDescending(row => row.At), limit, rows.Count, OtlpInspection.Total(root) > rows.Count);
        }, cancellation);
    }

    public Task<TelemetryPage<TelemetrySpan>> Trace(string traceId, int limit, CancellationToken cancellation)
    {
        if (!ValidTrace(traceId) || limit is < 1 or > 200) return Task.FromResult(Failure<TelemetrySpan>("invalid", "traceId must be 32 nonzero hexadecimal digits; limit must be 1–200."));
        return Read("spans", new() { ["traceId"] = traceId.ToLowerInvariant(), ["limit"] = (limit + 1).ToString() }, root =>
        {
            var rows = OtlpInspection.Spans(root).Where(span => span.TraceId == traceId.ToLowerInvariant()).OrderBy(span => span.At).ToList();
            return rows.Count == 0 ? Failure<TelemetrySpan>("not-found", "Trace not found in retained diagnostics.") : Page(rows, limit, rows.Count, OtlpInspection.Total(root) > rows.Count);
        }, cancellation);
    }

    private async Task<TelemetryPage<T>> Read<T>(string path, Dictionary<string, string?> query, Func<JsonElement, TelemetryPage<T>> project, CancellationToken cancellation)
    {
        if (string.IsNullOrWhiteSpace(configuration["OTEL_EXPORTER_OTLP_ENDPOINT"])) return Failure<T>("disabled", "Diagnostics disabled. Performance history, logs_read and run_events remain available.");
        if (!Uri.TryCreate(configuration["TELEMETRY_INTERNAL_URL"], UriKind.Absolute, out var address) || address.Scheme is not ("http" or "https"))
            return Failure<T>("unavailable", "The diagnostics inspection address is not configured.");
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellation);
        timeout.CancelAfter(TimeSpan.FromSeconds(5));
        try
        {
            using var http = clients.CreateClient(HttpClientName);
            using var request = new HttpRequestMessage(HttpMethod.Get, new Uri(address.AbsoluteUri.TrimEnd('/') + QueryHelpers.AddQueryString("/api/telemetry/" + path, query)));
            if (!string.IsNullOrWhiteSpace(configuration["TELEMETRY_API_KEY"])) request.Headers.Add("X-API-Key", configuration["TELEMETRY_API_KEY"]);
            using var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, timeout.Token);
            if (response.StatusCode == HttpStatusCode.NotFound) return Failure<T>("not-found", "The diagnostics resource, trace or inspection endpoint was not found.");
            if (!response.IsSuccessStatusCode) return Failure<T>("unavailable", $"Diagnostics inspection failed (HTTP {(int)response.StatusCode}).");
            await response.Content.LoadIntoBufferAsync(4 * 1024 * 1024, timeout.Token);
            using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(timeout.Token), cancellationToken: timeout.Token);
            return project(document.RootElement);
        }
        catch (OperationCanceledException) when (!cancellation.IsCancellationRequested) { return Failure<T>("unavailable", "Diagnostics inspection timed out."); }
        catch (Exception error) when (error is HttpRequestException or JsonException or InvalidOperationException)
        { return Failure<T>("unavailable", "Diagnostics could not be read. The service may be unavailable or the response too large; narrow the query."); }
    }

    private static TelemetryPage<T> Page<T>(IEnumerable<T> rows, int limit, int scanned, bool sourceTruncated)
    {
        var items = new List<T>();
        var size = 0;
        foreach (var row in rows)
        {
            size += JsonSerializer.SerializeToUtf8Bytes(row).Length;
            if (items.Count == limit || size > 64_000) return new("ready", "Results limited; narrow the filters. Long text and attributes are abbreviated.", items, true, scanned);
            items.Add(row);
        }
        return new("ready", sourceTruncated ? "Only a recent portion of retained telemetry was scanned; narrow service, severity or trace filters. Long text and attributes are abbreviated." : "Long text and attributes are abbreviated.", items, sourceTruncated, scanned);
    }
    private static TelemetryPage<T> Failure<T>(string state, string message) => new(state, message, [], false, 0);
    private static bool Valid(int hours, int limit, int max, params string?[] texts) => hours is >= 1 and <= 24 && limit >= 1 && limit <= max && texts.All(text => text is null || text.Length is > 0 and <= 200);
    private static bool ValidTrace(string traceId) => traceId.Length == 32 && traceId.All(Uri.IsHexDigit) && traceId.Any(character => character != '0');
    private static bool Matches(string text, string? search) => search is null || text.Contains(search, StringComparison.OrdinalIgnoreCase);
}
