namespace PowerLoom.Features.Continue.Models;

// What one kind of target gives the chat note: everything but the shared template. Steps in the order the chat takes
// them: read first, `Before` (preparation), the briefing in `Briefing`'s outline, `Ending` (the one question), `AfterYes`.
public sealed record ChatBrief(
    string Vault,
    string Title,
    IReadOnlyList<ReadFirstLink> ReadFirst,
    IReadOnlyList<string> Before,
    IReadOnlyList<string> Briefing,
    string Ending,
    IReadOnlyList<string> AfterYes,
    IReadOnlyList<string> Repos,
    IReadOnlyList<ChatSkill> Skills,
    IReadOnlyList<ChatSection> Sections,
    IReadOnlyList<string> Rules,
    IReadOnlyList<string> ExtraFolders)
{
    public static ChatBrief For(string vault, string title) => new(vault, title, [], [], [], "", [], [], [], [], [], []);
}
