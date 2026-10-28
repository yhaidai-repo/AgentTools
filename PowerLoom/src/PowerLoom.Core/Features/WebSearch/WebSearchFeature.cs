namespace PowerLoom.Features.WebSearch;

public static class WebSearchFeature
{
    public static IServiceCollection AddWebSearchFeature(this IServiceCollection services)
    {
        services.AddScoped<WebSearchConnection>();

        return services;
    }
}
