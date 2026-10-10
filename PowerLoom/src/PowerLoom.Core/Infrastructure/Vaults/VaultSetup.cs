namespace PowerLoom.Infrastructure.Vaults;

public static class VaultSetup
{
    public static WebApplicationBuilder AddPowerLoomVaults(this WebApplicationBuilder builder)
    {
        builder.Services
            .AddOptions<VaultOptions>()
            .BindConfiguration(VaultOptions.Section)
            .Validate(options => !string.IsNullOrWhiteSpace(options.Root), "Vaults:Root is required: the folder holding every vault.")
            .ValidateOnStart();
        builder.Services.AddSingleton<VaultRoots>();

        return builder;
    }
}
