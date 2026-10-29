using PowerLoom.Features.Status.Probes;
using PowerLoom.Features.Status.Performance;
using PowerLoom.Features.Status.Telemetry;

namespace PowerLoom.Features.Status;

public static class StatusFeature
{
    public static IServiceCollection AddStatusFeature(this IServiceCollection services)
    {
        services.AddScoped<SystemStatusReader>();
        services.AddHttpClient(AspireTelemetryReader.HttpClientName);
        services.AddScoped<AspireTelemetryReader>();
        services.AddSingleton<PerformanceAccumulator>();
        services.AddScoped<PerformanceStore>();
        services.AddSingleton<PerformanceSampler>();
        services.AddHostedService(provider => provider.GetRequiredService<PerformanceSampler>());
        services.AddScoped<VaultStatusProbe>();
        services.AddScoped<MessagingStatusProbe>();
        services.AddScoped<RunsStatusProbe>();
        services.AddScoped<SchedulesStatusProbe>();
        services.AddScoped<BudgetStatusProbe>();
        services.AddScoped<OutsideAccessProbe>();
        services.AddScoped<CleanupStatusProbe>();

        return services;
    }
}
