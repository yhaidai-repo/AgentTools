namespace PowerLoom.Infrastructure.Backlog;

public sealed class BacklogOptions
{
    public const string Section = "Backlog";

    // adoa's backlog vault as mounted (adoa's BACKLOG_MOUNT): each vault's rendered backlog is a folder in it.
    public string Root { get; set; } = "";
}
