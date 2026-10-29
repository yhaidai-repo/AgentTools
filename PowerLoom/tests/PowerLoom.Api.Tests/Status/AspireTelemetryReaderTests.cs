using System.Net;
using Microsoft.Extensions.Configuration;
using PowerLoom.Features.Status.Telemetry;

namespace PowerLoom.Api.Tests.Status;

public sealed class AspireTelemetryReaderTests
{
    private static readonly DateTime Now = new(2030, 1, 1, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task Diagnostics_Disabled_DoesNotContactAspire()
    {
        var handler = new Handler(_ => throw new InvalidOperationException("must not send"));
        var reader = Reader(handler, enabled: false);
        Assert.Equal("disabled", (await reader.Logs(1, null, null, null, null, 25, default)).State);
        Assert.Equal("disabled", (await reader.Traces(1, null, false, 0, null, 20, default)).State);
        Assert.Equal("disabled", (await reader.Trace(TelemetryPayload.TraceId, 100, default)).State);
        Assert.Equal(0, handler.Calls);
    }

    [Fact]
    public async Task Logs_FiltersBoundedRecentScanAndMarksIncompleteCoverage()
    {
        var handler = new Handler(request => {
            Assert.Contains("resource=PowerLoom", request.RequestUri!.Query);
            Assert.Contains("severity=Error", request.RequestUri.Query);
            Assert.Contains("limit=500", request.RequestUri.Query);
            Assert.Equal("test-inspection-key", Assert.Single(request.Headers.GetValues("X-API-Key")));
            return Answer(TelemetryPayload.Envelope(TelemetryPayload.Logs(Now, count: 3), 700, 3));
        });
        var page = await Reader(handler).Logs(1, "PowerLoom", "Error", null, "FAILED", 1, default);
        Assert.Equal("ready", page.State);
        Assert.True(page.Truncated);
        Assert.Equal(3, page.Scanned);
        var log = Assert.Single(page.Items);
        Assert.Equal("PowerLoom", log.Service);
        Assert.Equal(TelemetryPayload.TraceId, log.TraceId);
        Assert.Equal("AT-PROBE-001", log.Attributes["task.id"]);
    }

    [Fact]
    public async Task Traces_CombinesServicesAndUsesWholeTraceDurationAndChildErrors()
    {
        var reader = Reader(new Handler(_ => Answer(TelemetryPayload.Envelope(TelemetryPayload.Spans(Now)))));
        var trace = Assert.Single((await reader.Traces(1, null, true, 90, "GET", 20, default)).Items);
        Assert.Equal(100, trace.DurationMs);
        Assert.True(trace.HasError);
        Assert.Equal(2, trace.SpanCount);
        Assert.Equal(new[] { "PowerLoom", "database" }, trace.Services);
        Assert.Empty((await reader.Traces(1, null, false, 101, null, 20, default)).Items);
    }

    [Fact]
    public async Task Trace_PreservesParentsAndErrorsAndSignalsPartialSpans()
    {
        var reader = Reader(new Handler(_ => Answer(TelemetryPayload.Envelope(TelemetryPayload.Spans(Now), 2))));
        var spans = await reader.Trace(TelemetryPayload.TraceId, 100, default);
        var child = spans.Items[1];
        Assert.Equal(TelemetryPayload.RootId, child.ParentSpanId);
        Assert.Equal(60, child.DurationMs);
        Assert.True(child.HasError);
        Assert.Equal("synthetic database error", Assert.Single(child.Events).Attributes["exception.message"]);
        Assert.False(spans.Truncated);
        Assert.True((await reader.Trace(TelemetryPayload.TraceId, 1, default)).Truncated);
    }

    [Theory]
    [InlineData(401, "unavailable")]
    [InlineData(404, "not-found")]
    [InlineData(503, "unavailable")]
    public async Task HttpFailure_IsNotReportedAsAnEmptySuccessfulQuery(int status, string state)
    {
        var result = await Reader(new Handler(_ => new HttpResponseMessage((HttpStatusCode)status))).Logs(1, null, null, null, null, 25, default);
        Assert.Equal(state, result.State);
        Assert.NotNull(result.Message);
    }

    [Theory]
    [InlineData("{}")]
    [InlineData("not JSON")]
    public async Task MalformedResponse_IsUnavailable(string body)
    {
        var result = await Reader(new Handler(_ => Answer(body))).Logs(1, null, null, null, null, 25, default);
        Assert.Equal("unavailable", result.State);
    }

    [Fact]
    public async Task OldLogsAndOutputBudget_DoNotPretendThereAreNoMoreMatches()
    {
        var old = Reader(new Handler(_ => Answer(TelemetryPayload.Envelope(TelemetryPayload.Logs(Now.AddHours(-2))))));
        Assert.Empty((await old.Logs(1, null, null, null, null, 25, default)).Items);
        var many = Reader(new Handler(_ => Answer(TelemetryPayload.Envelope(TelemetryPayload.Logs(Now, new string('x', 3000), 100), 100))));
        var bounded = await many.Logs(24, null, null, null, null, 100, default);
        Assert.True(bounded.Truncated);
        Assert.InRange(bounded.Items.Count, 1, 99);
        Assert.EndsWith("…", bounded.Items[0].Body);
    }

    [Fact]
    public async Task InvalidFilters_DoNotContactAspire()
    {
        var handler = new Handler(_ => throw new InvalidOperationException("must not send"));
        var reader = Reader(handler);
        Assert.Equal("invalid", (await reader.Logs(25, null, null, null, null, 25, default)).State);
        Assert.Equal("invalid", (await reader.Trace("../secrets", 100, default)).State);
        Assert.Equal("invalid", (await reader.Trace(new string('0', 32), 100, default)).State);
        Assert.Equal("invalid", (await reader.Traces(1, null, false, double.NaN, null, 20, default)).State);
        Assert.Equal(0, handler.Calls);
    }

    [Fact]
    public async Task TransportTimeout_IsExplicitAndCallerCancellationIsPreserved()
    {
        var reader = Reader(new Handler(_ => throw new TaskCanceledException()));
        Assert.Equal("unavailable", (await reader.Trace(TelemetryPayload.TraceId, 100, default)).State);
        using var cancellation = new CancellationTokenSource();
        await cancellation.CancelAsync();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => reader.Trace(TelemetryPayload.TraceId, 100, cancellation.Token));
    }

    private static AspireTelemetryReader Reader(Handler handler, bool enabled = true) => new(new Clients(handler), new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> {
        ["OTEL_EXPORTER_OTLP_ENDPOINT"] = enabled ? "http://telemetry:4317" : "", ["TELEMETRY_INTERNAL_URL"] = "http://diagnostics:18888", ["TELEMETRY_API_KEY"] = "test-inspection-key"
    }).Build(), new Clock());
    private static HttpResponseMessage Answer(string body) => new(HttpStatusCode.OK) { Content = new StringContent(body) };
    private sealed class Clock : TimeProvider { public override DateTimeOffset GetUtcNow() => new(Now); }
    private sealed class Clients(HttpMessageHandler handler) : IHttpClientFactory { public HttpClient CreateClient(string name) => new(handler, disposeHandler: false); }
    private sealed class Handler(Func<HttpRequestMessage, HttpResponseMessage> send) : HttpMessageHandler
    {
        public int Calls { get; private set; }
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) { Calls++; return Task.FromResult(send(request)); }
    }
}
