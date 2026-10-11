namespace PowerLoom.Infrastructure.Runner;

public static class RunnerSetup
{
    public static WebApplicationBuilder AddPowerLoomRunner(this WebApplicationBuilder builder)
    {
        builder.Services.AddOptions<RunnerOptions>().BindConfiguration(RunnerOptions.Section);
        builder.Services.AddHttpClient(RunnerClient.HttpClientName);
        builder.Services.AddSingleton<IRunnerClient, RunnerClient>();

        return builder;
    }
}
