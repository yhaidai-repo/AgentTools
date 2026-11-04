using PowerLoom.Features.Flows.Engine;
using PowerLoom.Infrastructure.Scheduling;

namespace PowerLoom.Features.Flows;

public static class FlowsFeature
{
    public static IServiceCollection AddFlowsFeature(this IServiceCollection services)
    {
        services.AddScoped<FlowCatalogue>();
        services.AddScoped<FlowExecutions>();
        services.AddScoped<FlowAdvancer>();
        services.AddSingleton<ICronSource, FlowCronSource>();

        return services;
    }
}
