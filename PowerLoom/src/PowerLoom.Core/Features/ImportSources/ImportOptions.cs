namespace PowerLoom.Features.ImportSources;

public sealed class ImportOptions
{
    public const string Section = "Import";

    // The import inbox folder (bind-mounted), where the import sources' files arrive; empty = the sources only report it.
    public string InboxRoot { get; set; } = "";
}
