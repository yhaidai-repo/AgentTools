using System.Reflection;
using JasperFx;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Features.Agents;
using PowerLoom.Features.Continue;
using PowerLoom.Features.Docs;
using PowerLoom.Features.Drafts;
using PowerLoom.Features.ImportSources;
using PowerLoom.Features.Meetings;
using PowerLoom.Features.Pbis;
using PowerLoom.Features.Repos;
using PowerLoom.Features.Skills;
using PowerLoom.Features.Status;
using PowerLoom.Features.Tasks;
using PowerLoom.Features.Vaults;
using PowerLoom.Infrastructure.Backlog;
using PowerLoom.Infrastructure.ChatLaunch;
using PowerLoom.Infrastructure.Health;
using PowerLoom.Infrastructure.Http;
using PowerLoom.Infrastructure.Messaging;
using PowerLoom.Infrastructure.Persistence;
using PowerLoom.Infrastructure.Runner;
using PowerLoom.Infrastructure.Scheduling;
using PowerLoom.Infrastructure.Telemetry;
using PowerLoom.Infrastructure.VaultCapture;
using PowerLoom.Infrastructure.VaultScan;
using PowerLoom.Infrastructure.Vaults;
using Wolverine.Http;

namespace PowerLoom;

// The composition root: the infrastructure, then every feature.
public static class PowerLoomSetup
{
    public static WebApplicationBuilder AddPowerLoom(this WebApplicationBuilder builder, Assembly applicationAssembly)
    {
        builder.AddPowerLoomJson();
        builder.AddPowerLoomTelemetry();
        builder.AddPowerLoomPersistence();
        builder.AddPowerLoomMessaging(applicationAssembly);
        builder.AddPowerLoomScheduling();
        builder.AddPowerLoomHealth();
        builder.AddPowerLoomVaults();
        builder.AddPowerLoomVaultCapture();
        builder.AddPowerLoomVaultScan();
        builder.AddPowerLoomBacklog();
        builder.AddPowerLoomChatLaunch();
        builder.AddPowerLoomRunner();
        builder.Services.AddVaultsFeature();
        builder.Services.AddDocsFeature();
        builder.Services.AddDraftsFeature();
        builder.Services.AddContinueFeature();
        builder.Services.AddPbisFeature();
        builder.Services.AddImportSourcesFeature();
        builder.Services.AddMeetingsFeature();
        builder.Services.AddTasksFeature();
        builder.Services.AddReposFeature();
        builder.Services.AddSkillsFeature();
        builder.Services.AddAgentsFeature();
        builder.Services.AddStatusFeature();
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
