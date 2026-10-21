using PowerLoom.DevHubIntegration.Features.BrowserArtefacts;
using PowerLoom.DevHubIntegration.Features.LocalBranches;
using PowerLoom.Features.Cleanup;
using PowerLoom.Infrastructure.LocalBranches;
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
        builder.Services.AddScoped<ILocalBranches, DevHubLocalBranches>();
        builder.Services.AddHttpClient(HttpDevHubBrowserArtefacts.HttpClientName);
        builder.Services.AddSingleton<IDevHubBrowserArtefacts, HttpDevHubBrowserArtefacts>();
        builder.Services.AddScoped<IArtefactCleaner, BrowserArtefactsCleaner>();

        return builder;
    }
}
