using OpenTelemetry.Logs;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

namespace PowerLoom.Infrastructure.Telemetry;

public static class TelemetrySetup
{
    private const string ServiceName = "PowerLoom";

    // The OTLP exporter's own setting; without a collector to send to, nothing is exported (tests, a bare local run).
    private const string EndpointSetting = "OTEL_EXPORTER_OTLP_ENDPOINT";

    public static WebApplicationBuilder AddPowerLoomTelemetry(this WebApplicationBuilder builder)
    {
        if (string.IsNullOrWhiteSpace(builder.Configuration[EndpointSetting]))
            return builder;

        builder.Services.AddOpenTelemetry()
            .ConfigureResource(resource => resource.AddService(ServiceName))
            .WithTracing(AddTracing)
            .WithMetrics(AddMetrics);
        builder.Logging.AddOpenTelemetry(logging =>
        {
            logging.IncludeScopes = true;
            logging.AddOtlpExporter();
        });

        return builder;
    }

    // One agent run is one trace: the runner continues the trace from the traceparent of the HttpClient call.
    private static void AddTracing(TracerProviderBuilder tracing)
    {
        tracing
            .AddAspNetCoreInstrumentation()
            .AddHttpClientInstrumentation()
            .AddSource("Wolverine")
            .AddSource("Npgsql")
            .AddOtlpExporter();
    }

    // "Wolverine*": the meter is named Wolverine:<service>, so the bare name matches nothing.
    private static void AddMetrics(MeterProviderBuilder metrics)
    {
        metrics
            .AddAspNetCoreInstrumentation()
            .AddHttpClientInstrumentation()
            .AddRuntimeInstrumentation()
            .AddMeter("Wolverine*")
            .AddMeter("Npgsql")
            .AddOtlpExporter();
    }
}
