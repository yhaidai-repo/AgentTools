using PowerLoom.Persistence;

namespace PowerLoom.Infrastructure.Health;

public static class HealthSetup
{
    public const string Path = "/health";

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
        app.MapHealthChecks(Path);

        return app;
    }
}
