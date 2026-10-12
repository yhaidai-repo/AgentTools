using PowerLoom.SqlIntegration.Features.Connections;
using PowerLoom.SqlIntegration.Settings;

namespace PowerLoom.SqlIntegration;

public static class SqlIntegrationSetup
{
    public static WebApplicationBuilder AddSqlIntegration(this WebApplicationBuilder builder)
    {
        builder.Services.AddScoped<ReadSqlSettingsStore>();
        builder.Services.AddScoped<ReadSqlConnections>();
        builder.Services.AddSingleton<ISqlConnectionTester, RunnerSqlConnectionTester>();

        return builder;
    }
}
