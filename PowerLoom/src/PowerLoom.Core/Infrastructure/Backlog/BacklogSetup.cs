namespace PowerLoom.Infrastructure.Backlog;

public static class BacklogSetup
{
    public static WebApplicationBuilder AddPowerLoomBacklog(this WebApplicationBuilder builder)
    {
        builder.Services
            .AddOptions<BacklogOptions>()
            .BindConfiguration(BacklogOptions.Section)
            .Validate(options => !string.IsNullOrWhiteSpace(options.Root), "Backlog:Root is required: adoa's backlog vault mount.")
            .ValidateOnStart();
        builder.Services.AddSingleton<BacklogFiles>();

        return builder;
    }
}
