namespace PowerLoom.Infrastructure.Backlog;

public sealed class BacklogOptions
{
    public const string Section = "Backlog";

    // PowerLoom's backlog vault as mounted (PowerLoom's BACKLOG_MOUNT): each vault's rendered backlog is a folder in it.
    public string Root { get; set; } = "";
}
