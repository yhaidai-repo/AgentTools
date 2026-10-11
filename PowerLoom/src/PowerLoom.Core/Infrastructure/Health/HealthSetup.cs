using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using PowerLoom.Persistence;

namespace PowerLoom.Infrastructure.Health;

public static class HealthSetup
{
    public const string Path = "/health";

    // The runner's check answers on its own path: Docker's healthcheck of PowerLoom must not depend on a service that
    // starts after PowerLoom is healthy.
    public const string RunnerPath = "/health/runner";
    public const string RunnerTag = "runner";

    // Docker's healthcheck and the dashboards: the database and the ticker.
    public static WebApplicationBuilder AddPowerLoomHealth(this WebApplicationBuilder builder)
    {
        builder.Services.AddSingleton(TimeProvider.System);
        builder.Services.AddHealthChecks()
            .AddDbContextCheck<PowerLoomDbContext>("database")
            .AddCheck<ScheduleTickerHealthCheck>("schedule-ticker");

        return builder;
    }

    public static WebApplication MapPowerLoomHealth(this WebApplication app)
    {
        app.MapHealthChecks(Path, new HealthCheckOptions { Predicate = check => !check.Tags.Contains(RunnerTag) });
        app.MapHealthChecks(RunnerPath, new HealthCheckOptions { Predicate = check => check.Tags.Contains(RunnerTag) });

        return app;
    }
}
