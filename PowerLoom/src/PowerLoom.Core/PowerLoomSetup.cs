using System.Reflection;
using JasperFx;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Features.Vaults;
using PowerLoom.Infrastructure.Health;
using PowerLoom.Infrastructure.Messaging;
using PowerLoom.Infrastructure.Persistence;
using PowerLoom.Infrastructure.Scheduling;
using PowerLoom.Infrastructure.Telemetry;
using PowerLoom.Infrastructure.Vaults;
using Wolverine.Http;

namespace PowerLoom;

// The composition root: the infrastructure, then every feature.
public static class PowerLoomSetup
{
    public static WebApplicationBuilder AddPowerLoom(this WebApplicationBuilder builder, Assembly applicationAssembly)
    {
        builder.AddPowerLoomTelemetry();
        builder.AddPowerLoomPersistence();
        builder.AddPowerLoomMessaging(applicationAssembly);
        builder.AddPowerLoomScheduling();
        builder.AddPowerLoomHealth();
        builder.AddPowerLoomVaults();
        builder.Services.AddVaultsFeature();
        builder.Services.AddOpenApi();

        return builder;
    }

    public static WebApplication MapPowerLoom(this WebApplication app)
    {
        app.MapWolverineEndpoints();
        app.MapPowerLoomHealth();
        // /openapi/v1.json: the API is internal, so the document is always on.
        app.MapOpenApi();

        return app;
    }

    // JasperFx commands too: `describe` (endpoints, queues) and `codegen write` (static code for the Docker image).
    public static Task<int> RunPowerLoomAsync(this WebApplication app, string[] args) => app.RunJasperFxCommands(args);
}
