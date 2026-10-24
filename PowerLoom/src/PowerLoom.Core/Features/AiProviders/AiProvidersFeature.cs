namespace PowerLoom.Features.AiProviders;

public static class AiProvidersFeature
{
    public static IServiceCollection AddAiProvidersFeature(this IServiceCollection services)
    {
        services.AddScoped<ClaudeConnection>();
        services.AddScoped<CodexConnection>();
        services.AddSingleton<ICodexLogin, RunnerCodexLogin>();

        return services;
    }
}
