namespace PowerLoom.Infrastructure.Persistence;

public static class PersistenceSetup
{
    // Registered before Wolverine, so the schema is current before any handler or endpoint runs.
    public static WebApplicationBuilder AddPowerLoomPersistence(this WebApplicationBuilder builder)
    {
        builder.Services.AddSingleton<DatabaseMigrator>();
        builder.Services.AddHostedService(services => services.GetRequiredService<DatabaseMigrator>());

        return builder;
    }
}
