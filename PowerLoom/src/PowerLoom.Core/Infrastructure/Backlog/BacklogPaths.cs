using System.Text.RegularExpressions;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Infrastructure.Backlog;

// Where adoa renders a vault's backlog notes (the TypeScript side's paths.ts): relative to the vault's backlog folder.
public static partial class BacklogPaths
{
    public const string IndexPath = "backlog-index.md";
    public const string PbiTemplatePath = "_templates/pbi.md";

    private const int SlugMax = 40;

    public static string PbiNoteName(int adoId) => $"PBI-{adoId}";

    // The folder keeps the slug of the first title; callers reuse the stored path so a rename doesn't orphan notes.
    public static string PbiNotePath(int adoId, string title) => $"pbi/{PbiNoteName(adoId)}-{Slugify(title)}/{PbiNoteName(adoId)}.md";

    public static string RefinementNoteName(int adoId) => $"{PbiNoteName(adoId)}-refinement";

    public static string DesignNoteName(int adoId) => $"{PbiNoteName(adoId)}-design";

    public static string ImplementNoteName(int adoId) => $"{PbiNoteName(adoId)}-implement";

    // Refinement, design and item notes live in the PBI's folder, next to its note.
    public static string RefinementNotePath(string pbiNotePath, int adoId) => $"{FolderOf(pbiNotePath)}/{RefinementNoteName(adoId)}.md";

    public static string DesignNotePath(string pbiNotePath, int adoId) => $"{FolderOf(pbiNotePath)}/{DesignNoteName(adoId)}.md";

    public static string ImplementNotePath(string pbiNotePath, int adoId) => $"{FolderOf(pbiNotePath)}/{ImplementNoteName(adoId)}.md";

    public static string ItemNotePath(string pbiNotePath, string itemId, ItemKind kind) => $"{FolderOf(pbiNotePath)}/{ItemFolder(kind)}/{itemId}.md";

    // Uploads keep their name, prefixed with the attachment ref so two files of the same name never clash.
    public static string AttachmentRef(int attachmentId) => $"ATT-{attachmentId}";

    public static string AttachmentFileName(string attachmentRef, string fileName) => $"{attachmentRef}-{UnsafeName().Replace(fileName, "-")}";

    public static string AttachmentPath(string pbiNotePath, string attachmentRef, string fileName) => $"{FolderOf(pbiNotePath)}/attachments/{AttachmentFileName(attachmentRef, fileName)}";

    public static string ReviewNoteName(int prId) => $"PR-{prId}";

    public static string ChatNotePath(string kind, string id) => $"chats/{kind}-{id}.md";

    public static string FolderOf(string path) => path[..path.LastIndexOf('/')];

    private static string ItemFolder(ItemKind kind) => kind switch { ItemKind.Question => "questions", ItemKind.ResearchResult => "research", _ => "tasks" };

    private static string Slugify(string title)
    {
        var slug = Edges().Replace(NotAlphanumeric().Replace(title.ToLowerInvariant(), "-"), "");
        var cut = slug[..Math.Min(slug.Length, SlugMax)].TrimEnd('-');

        return cut.Length > 0 ? cut : "untitled";
    }

    [GeneratedRegex("[^a-z0-9]+")]
    private static partial Regex NotAlphanumeric();

    [GeneratedRegex("^-+|-+$")]
    private static partial Regex Edges();

    [GeneratedRegex("[^A-Za-z0-9._-]+")]
    private static partial Regex UnsafeName();
}
