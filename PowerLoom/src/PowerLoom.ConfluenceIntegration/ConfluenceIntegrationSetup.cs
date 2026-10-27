using PowerLoom.ConfluenceIntegration.Client;
using PowerLoom.ConfluenceIntegration.Features.Pages;
using PowerLoom.ConfluenceIntegration.Status;

namespace PowerLoom.ConfluenceIntegration;

public static class ConfluenceIntegrationSetup
{
    public const string HttpClientName = "confluence";

    public static WebApplicationBuilder AddConfluenceIntegration(this WebApplicationBuilder builder)
    {
        builder.Services.AddOptions<ConfluenceOptions>().BindConfiguration(ConfluenceOptions.Section);
        builder.Services.AddHttpClient(HttpClientName).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
        builder.Services.AddSingleton<IConfluenceClientFactory, ConfluenceClientFactory>();
        builder.Services.AddScoped<PageSync>();
        builder.Services.AddHostedService<ConfluenceStatusReporter>();

        return builder;
    }
}
