using Alba;
using PowerLoom.Features.Status.Telemetry;

namespace PowerLoom.Api.Tests.Status;

[Collection(PowerLoomCollection.Name)]
public sealed class TelemetryEndpointTests(PowerLoomHost host)
{
    [Theory]
    [InlineData("/api/status/telemetry/logs")]
    [InlineData("/api/status/telemetry/traces")]
    [InlineData("/api/status/telemetry/traces/1234567890abcdef1234567890abcdef")]
    public async Task Endpoint_DiagnosticsOff_ReturnsExplicitDisabledState(string url)
    {
        var result = await host.Host.GetAsJson<TelemetryPage<object>>(url);
        Assert.Equal("disabled", result!.State);
        Assert.Contains("Diagnostics disabled", result.Message);
        Assert.Empty(result.Items);
    }
}
