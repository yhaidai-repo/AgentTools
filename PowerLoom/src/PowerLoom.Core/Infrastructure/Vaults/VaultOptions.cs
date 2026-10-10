namespace PowerLoom.Infrastructure.Vaults;

public sealed class VaultOptions
{
    public const string Section = "Vaults";

    // The folder holding every Obsidian vault (adoa's VAULTS_DIR): a vault is a folder in it, named after it.
    public string Root { get; set; } = "";

    // The same folder as the PC sees it: written into a new vault's files and into chat links.
    public string HostRoot { get; set; } = "";

    // adoa's templates for a new vault's root files (AGENTS.md, index.md, www-log.md).
    public string TemplateHome { get; set; } = "";

    // Folder names that are never a vault of adoa's (its own backlog vault); comma-separated.
    public string Exclude { get; set; } = "";

    public IReadOnlyList<string> ExcludedNames => Exclude.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}
