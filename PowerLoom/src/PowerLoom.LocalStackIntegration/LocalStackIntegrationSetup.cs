using PowerLoom.LocalStackIntegration.Features.Bridge;
using PowerLoom.LocalStackIntegration.Settings;

namespace PowerLoom.LocalStackIntegration;

public static class LocalStackIntegrationSetup
{
    public static WebApplicationBuilder AddLocalStackIntegration(this WebApplicationBuilder builder)
    {
        builder.Services.AddScoped<LocalStackSettingsStore>();
        builder.Services.AddScoped<LocalStackConnection>();
        builder.Services.AddSingleton<ILocalStackTester, RunnerLocalStackTester>();

        return builder;
    }
}
