using PowerLoom.GitHubIntegration.Client;
using PowerLoom.GitHubIntegration.Features.Connection;
using PowerLoom.GitHubIntegration.Scheduling;
using PowerLoom.GitHubIntegration.Settings;
using PowerLoom.Infrastructure.Scheduling;

namespace PowerLoom.GitHubIntegration;

public static class GitHubIntegrationSetup
{
    public const string HttpClientName = "github";

    public static WebApplicationBuilder AddGitHubIntegration(this WebApplicationBuilder builder)
    {
        builder.Services.AddHttpClient(HttpClientName);
        builder.Services.AddSingleton<IGitHubClientFactory, GitHubClientFactory>();
        builder.Services.AddScoped<GitHubSettingsStore>();
        builder.Services.AddScoped<GitHubConnection>();
        builder.Services.AddSingleton<ICronSource, GitHubCronSource>();

        return builder;
    }
}
