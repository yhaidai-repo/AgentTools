namespace PowerLoom.Infrastructure.Scheduling;

public static class SchedulingSetup
{
    public static WebApplicationBuilder AddPowerLoomScheduling(this WebApplicationBuilder builder)
    {
        // One instance: the hosted service, and the same object for health checks and tests.
        builder.Services.AddSingleton<ScheduleTicker>();
        builder.Services.AddHostedService(services => services.GetRequiredService<ScheduleTicker>());

        return builder;
    }
}
