using JasperFx;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Features.Vaults;
using PowerLoom.Infrastructure.Health;
using PowerLoom.Infrastructure.Messaging;
using PowerLoom.Infrastructure.Scheduling;
using PowerLoom.Infrastructure.Telemetry;
using PowerLoom.Infrastructure.Vault;
using Wolverine.Http;

namespace PowerLoom;

// The composition root: the infrastructure, then every feature.
public static class PowerLoomSetup
{
    public static WebApplicationBuilder AddPowerLoom(this WebApplicationBuilder builder)
    {
        builder.AddPowerLoomTelemetry();
        builder.AddPowerLoomMessaging();
        builder.AddPowerLoomScheduling();
        builder.AddPowerLoomHealth();
        builder.AddPowerLoomVaults();
        builder.Services.AddVaultsFeature();

        return builder;
    }

    public static WebApplication MapPowerLoom(this WebApplication app)
    {
        app.MapWolverineEndpoints();
        app.MapPowerLoomHealth();

        return app;
    }

    // JasperFx commands too: `describe` (endpoints, queues) and `codegen write` (static code for the Docker image).
    public static Task<int> RunPowerLoomAsync(this WebApplication app, string[] args) => app.RunJasperFxCommands(args);
}
