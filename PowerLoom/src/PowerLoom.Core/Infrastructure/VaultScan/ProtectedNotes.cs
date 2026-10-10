namespace PowerLoom.Infrastructure.VaultScan;

public static class ProtectedNotes
{
    // The tech-writer owns draft/: drafts are merged and deleted there.
    private const string DraftFolder = "draft";

    // Dot folders (.obsidian, .usage, .trash, .git) are no notes: Obsidian, VaultUsage and the trash keep them.
    public static bool IsHiddenPath(string path) => path.Split('/').Any(part => part.StartsWith('.'));

    // Notes the vault review never offers or removes: root files (AGENTS.md, CLAUDE.md, index.md, www-log.md), drafts,
    // and a project's own `<key>/<key>-*.md` (index, registers, glossary, repos). Agents load them without a tool call,
    // so the usage log never counts them (VaultUsage limits).
    public static bool IsProtectedNote(string path)
    {
        var parts = path.Split('/');

        if (parts.Length == 1 || parts[0] == DraftFolder)
            return true;

        return parts.Length == 2 && parts[1].StartsWith($"{parts[0]}-", StringComparison.Ordinal);
    }

    // Notes whose links the vault review may fix: all but root files (the vault's rules) and drafts (the tech-writer's).
    public static bool IsLinkEditable(string path)
    {
        var parts = path.Split('/');

        return parts.Length > 1 && parts[0] != DraftFolder;
    }
}
