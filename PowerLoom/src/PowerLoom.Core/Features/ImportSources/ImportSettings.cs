namespace PowerLoom.Features.ImportSources;

public sealed class ImportSettings
{
    // How often the import sources are read.
    public string Cron { get; set; } = "*/5 * * * *";

    // Items imported per run, over all sources together; the rest wait for the next run.
    public int MaxItemsPerRun { get; set; } = 50;
}
