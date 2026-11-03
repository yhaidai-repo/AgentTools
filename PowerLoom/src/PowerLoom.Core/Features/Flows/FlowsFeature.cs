namespace PowerLoom.Features.Flows;

public static class FlowsFeature
{
    public static IServiceCollection AddFlowsFeature(this IServiceCollection services)
    {
        services.AddScoped<FlowCatalogue>();
        services.AddScoped<FlowExecutions>();

        return services;
    }
}
