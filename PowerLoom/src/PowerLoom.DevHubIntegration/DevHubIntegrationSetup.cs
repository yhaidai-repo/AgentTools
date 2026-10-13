using PowerLoom.DevHubIntegration.Features.DevHub;
using PowerLoom.DevHubIntegration.Settings;

namespace PowerLoom.DevHubIntegration;

public static class DevHubIntegrationSetup
{
    public static WebApplicationBuilder AddDevHubIntegration(this WebApplicationBuilder builder)
    {
        builder.Services.AddScoped<DevHubSettingsStore>();
        builder.Services.AddScoped<DevHubConnection>();
        builder.Services.AddSingleton<IDevHubTester, RunnerDevHubTester>();

        return builder;
    }
}
