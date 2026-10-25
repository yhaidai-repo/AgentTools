using PowerLoom.GoogleDriveIntegration.Client;
using PowerLoom.GoogleDriveIntegration.Features.Connection;
using PowerLoom.GoogleDriveIntegration.Settings;

namespace PowerLoom.GoogleDriveIntegration;

public static class GoogleDriveIntegrationSetup
{
    public const string HttpClientName = "google";

    public static WebApplicationBuilder AddGoogleDriveIntegration(this WebApplicationBuilder builder)
    {
        builder.Services.AddHttpClient(HttpClientName);
        builder.Services.AddSingleton<IGoogleApi, GoogleApi>();
        builder.Services.AddScoped<GoogleDriveSettingsStore>();
        builder.Services.AddScoped<GoogleDriveConnection>();

        return builder;
    }
}
