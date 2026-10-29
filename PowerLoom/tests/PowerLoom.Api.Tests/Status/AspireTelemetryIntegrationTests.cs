using System.Text;
using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;
using Microsoft.Extensions.Configuration;
using PowerLoom.Features.Status.Telemetry;

namespace PowerLoom.Api.Tests.Status;

public sealed class AspireTelemetryIntegrationTests : IAsyncLifetime
{
    private readonly IContainer dashboard = new ContainerBuilder("mcr.microsoft.com/aspire/dashboard:13.6.2")
        .WithPortBinding(18888, true).WithPortBinding(4318, true)
        .WithEnvironment("ASPNETCORE_URLS", "http://0.0.0.0:18888")
        .WithEnvironment("ASPIRE_DASHBOARD_OTLP_HTTP_ENDPOINT_URL", "http://0.0.0.0:4318")
        .WithEnvironment("ASPIRE_DASHBOARD_UNSECURED_ALLOW_ANONYMOUS", "true")
        .WithWaitStrategy(Wait.ForUnixContainer().UntilHttpRequestIsSucceeded(request => request.ForPort(18888).ForPath("/"))).Build();

    public Task InitializeAsync() => dashboard.StartAsync();
    public async Task DisposeAsync() => await dashboard.DisposeAsync();

    [Fact]
    public async Task Inspection_RealAspire_RoundTripsFiltersParentsErrorsAndEmptyResults()
    {
        using var client = new HttpClient();
        var at = DateTime.UtcNow.AddSeconds(-1);
        foreach (var (kind, body) in new[] { ("logs", TelemetryPayload.Logs(at)), ("traces", TelemetryPayload.Spans(at)) })
        {
            using var response = await client.PostAsync($"http://{dashboard.Hostname}:{dashboard.GetMappedPublicPort(4318)}/v1/{kind}", new StringContent(body, Encoding.UTF8, "application/json"));
            response.EnsureSuccessStatusCode();
        }
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> {
            ["OTEL_EXPORTER_OTLP_ENDPOINT"] = "http://unused-exporter:4317",
            ["TELEMETRY_INTERNAL_URL"] = $"http://{dashboard.Hostname}:{dashboard.GetMappedPublicPort(18888)}"
        }).Build();
        var reader = new AspireTelemetryReader(new Clients(), configuration, TimeProvider.System);

        var logs = await reader.Logs(1, "PowerLoom", "Error", TelemetryPayload.TraceId.ToUpperInvariant(), "inspection", 25, default);
        Assert.Equal("ready", logs.State);
        Assert.Equal("PowerLoom", Assert.Single(logs.Items).Service);
        var empty = await reader.Logs(1, "PowerLoom", "Critical", null, null, 25, default);
        Assert.Equal("ready", empty.State);
        Assert.Empty(empty.Items);
        Assert.False(empty.Truncated);
        var traces = await reader.Traces(1, "PowerLoom", true, 90, null, 20, default);
        var trace = Assert.Single(traces.Items);
        Assert.True(trace.HasError);
        Assert.Equal(100, trace.DurationMs);
        Assert.Equal(2, trace.SpanCount);
        Assert.Contains("database", trace.Services);
        var spans = await reader.Trace(trace.TraceId, 100, default);
        Assert.False(spans.Truncated);
        Assert.Equal(TelemetryPayload.RootId, Assert.Single(spans.Items, span => span.HasError).ParentSpanId);
        var partial = await reader.Trace(trace.TraceId, 1, default);
        Assert.True(partial.Truncated);
        Assert.Single(partial.Items);
        Assert.Equal("not-found", (await reader.Trace(new string('f', 32), 100, default)).State);
    }

    private sealed class Clients : IHttpClientFactory { public HttpClient CreateClient(string name) => new(); }
}
