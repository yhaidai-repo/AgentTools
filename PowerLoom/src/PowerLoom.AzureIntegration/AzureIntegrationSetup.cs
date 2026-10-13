using PowerLoom.AzureIntegration.Features.Resources;
using PowerLoom.AzureIntegration.Settings;

namespace PowerLoom.AzureIntegration;

public static class AzureIntegrationSetup
{
    public static WebApplicationBuilder AddAzureIntegration(this WebApplicationBuilder builder)
    {
        builder.Services.AddScoped<ReadAzureSettingsStore>();
        builder.Services.AddScoped<ReadAzureResources>();
        builder.Services.AddSingleton<IAzureUserLogin, RunnerAzureUserLogin>();

        return builder;
    }
}
