namespace PowerLoom.Infrastructure.Vault;

public sealed class VaultOptions
{
    public const string Section = "Vaults";

    // The folder holding every Obsidian vault (adoa's VAULTS_DIR): a vault is a folder in it, named after it.
    public string Root { get; set; } = "";
}
