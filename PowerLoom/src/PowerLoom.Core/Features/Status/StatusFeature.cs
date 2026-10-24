using PowerLoom.Features.Status.Probes;

namespace PowerLoom.Features.Status;

public static class StatusFeature
{
    public static IServiceCollection AddStatusFeature(this IServiceCollection services)
    {
        services.AddScoped<SystemStatusReader>();
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
