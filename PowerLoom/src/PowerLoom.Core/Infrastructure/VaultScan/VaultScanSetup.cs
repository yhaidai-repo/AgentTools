using PowerLoom.Infrastructure.AgentConfig;

namespace PowerLoom.Infrastructure.VaultScan;

public static class VaultScanSetup
{
    public static WebApplicationBuilder AddPowerLoomVaultScan(this WebApplicationBuilder builder)
    {
        builder.Services.AddSingleton<VaultScanner>();
        builder.Services.AddScoped<AgentConfigReader>();

        return builder;
    }
}
