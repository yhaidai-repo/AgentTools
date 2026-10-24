namespace PowerLoom.Infrastructure.VaultCapture;

public static class VaultCaptureSetup
{
    public static WebApplicationBuilder AddPowerLoomVaultCapture(this WebApplicationBuilder builder)
    {
        builder.Services.AddOptions<VaultCaptureOptions>().BindConfiguration(VaultCaptureOptions.Section);
        builder.Services.AddSingleton<IVaultCapture, VaultCaptureCli>();

        return builder;
    }
}
