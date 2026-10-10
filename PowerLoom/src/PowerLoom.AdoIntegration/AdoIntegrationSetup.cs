using PowerLoom.AdoIntegration.Client;
using PowerLoom.AdoIntegration.Features.Connection;
using PowerLoom.AdoIntegration.Features.SyncPbis;
using PowerLoom.AdoIntegration.Features.SyncPullRequests;
using PowerLoom.AdoIntegration.Scheduling;
using PowerLoom.AdoIntegration.Settings;
using PowerLoom.Infrastructure.Backlog;
using PowerLoom.Infrastructure.Scheduling;

namespace PowerLoom.AdoIntegration;

public static class AdoIntegrationSetup
{
    public const string HttpClientName = "ado";

    public static WebApplicationBuilder AddAdoIntegration(this WebApplicationBuilder builder)
    {
        builder.Services.AddHttpClient(HttpClientName);
        builder.Services.AddSingleton<IAdoClientFactory, AdoClientFactory>();
        builder.Services.AddScoped<AdoSettingsStore>();
        builder.Services.AddScoped<ConnectionChecker>();
        builder.Services.AddScoped<WorkItemStore>();
        builder.Services.AddScoped<SyncBookkeeping>();
        builder.Services.AddScoped<SprintSync>();
        builder.Services.AddScoped<SinglePbiSync>();
        builder.Services.AddScoped<PullRequestSync>();
        builder.Services.AddSingleton<ICronSource, AdoCronSource>();
        // PBI notes link to the work item's page in Azure DevOps.
        builder.Services.AddScoped<IWorkItemLinks, WorkItemLinks>();

        return builder;
    }
}
