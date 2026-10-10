namespace PowerLoom.Infrastructure.Backlog;

// Where adoa renders a vault's backlog notes (the TypeScript side's paths.ts): relative to the vault's backlog folder.
public static class BacklogPaths
{
    public static string PbiNoteName(int adoId) => $"PBI-{adoId}";

    public static string RefinementNoteName(int adoId) => $"{PbiNoteName(adoId)}-refinement";

    public static string DesignNoteName(int adoId) => $"{PbiNoteName(adoId)}-design";

    // Refinement, design and item notes live in the PBI's folder, next to its note.
    public static string RefinementNotePath(string pbiNotePath, int adoId) => $"{FolderOf(pbiNotePath)}/{RefinementNoteName(adoId)}.md";

    public static string DesignNotePath(string pbiNotePath, int adoId) => $"{FolderOf(pbiNotePath)}/{DesignNoteName(adoId)}.md";

    public static string ReviewNoteName(int prId) => $"PR-{prId}";

    public static string ChatNotePath(string kind, string id) => $"chats/{kind}-{id}.md";

    public static string FolderOf(string path) => path[..path.LastIndexOf('/')];
}
