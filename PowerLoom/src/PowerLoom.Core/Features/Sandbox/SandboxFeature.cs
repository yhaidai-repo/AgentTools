namespace PowerLoom.Features.Sandbox;

public static class SandboxFeature
{
    public static IServiceCollection AddSandboxFeature(this IServiceCollection services)
    {
        services.AddScoped<SandboxSettingsStore>();

        return services;
    }
}
