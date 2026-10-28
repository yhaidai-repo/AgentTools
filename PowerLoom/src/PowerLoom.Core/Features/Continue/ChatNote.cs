using System.Text.Json;
using PowerLoom.Features.Continue.Models;
using PowerLoom.Infrastructure.Backlog;

namespace PowerLoom.Features.Continue;

// The one chat note every kind gets (user decision 2026-10-10): the chat reads it and follows its Start section.
public static class ChatNote
{
    // A command as the powerloom MCP server names its tool (`item.close` → `item_close`). The vault's MCP entry gives every
    // chat app the same server, so a note names the tool alone, without a client's prefix (stage 4 of the powerloom-mcp design).
    public static string Tool(string command) => command.Replace('.', '_');

    // An item's hand-offs, rendered by core's hand-off renderer (user decision 2026-10-28).
    public const string HandoffHeading = "Hand-off";

    private const string SectionStart = "\n## ";
    // Every kind's steps, reading and context, and each kind's own key section: an item's text and how it ends, a review's
    // pull request, a vault setup's steps (user decision 2026-10-24). The headings differ per kind, so one list serves all.
    private static readonly string[] ShownSections = ["Start", "Read first", "Context", HandoffHeading, "The item", "At the end", "Pull request", "Setup"];

    private static readonly string[] SharedRules =
    [
        "Azure DevOps is never written; nothing is pushed.",
        "The backlog vault is rendered by PowerLoom: read it, don't edit it. This note's Notes section is the user's.",
    ];

    public static string Render(ChatBrief brief, ChatKind kind, string id, string launcherLabel, string notesSection, DateOnly today)
    {
        var name = $"chat-{KindLabel(kind)}-{id}";
        var parts = new List<string>
        {
            Frontmatter(name, brief.Title, kind, id, today),
            $"# {brief.Title}",
            $"Handoff for the {launcherLabel} chat PowerLoom opened (\"Continue with {launcherLabel}\"). Paths are on the PC.",
            "## Start",
            StartSteps(brief),
            "## Read first",
            Bullets(brief.ReadFirst.Select(link => $"[[{link.Name}]] `{link.HostPath}`: {link.About}")),
            "## Context",
            Context(brief),
        };

        parts.AddRange(brief.Sections.SelectMany(section => new[] { $"## {section.Heading}", section.Markdown }));
        parts.Add("## Rules");
        parts.Add(Bullets(SharedRules.Concat(brief.Rules)));
        parts.Add(notesSection);

        return string.Join("\n\n", parts);
    }

    public static string NotesSectionOf(string? existing) => NotesSection.Of(existing);

    // What the chat shows the user (user decision 2026-10-24): the title and what the chat is told to do and read; the
    // other sections are only named, the chat reads them in the file.
    public static string ShortVersion(string note)
    {
        var sections = SplitSections(WithoutFrontmatter(note));
        var shown = sections.Skip(1).Where(section => ShownSections.Contains(Heading(section))).ToList();
        var others = sections.Skip(1).Select(Heading).Where(heading => !ShownSections.Contains(heading)).ToList();
        var othersLine = others.Count > 0 ? $"\n\nAlso in the note: {string.Join(", ", others)}." : "";

        return string.Concat(new[] { sections[0] }.Concat(shown)).TrimEnd() + othersLine;
    }

    private static string WithoutFrontmatter(string note)
    {
        var end = note.StartsWith("---\n") ? note.IndexOf("\n---\n", 4, StringComparison.Ordinal) : -1;

        return end < 0 ? note : note[(end + 5)..].TrimStart('\n');
    }

    // The part before the first heading, then each section with its leading newline, so they join back as they were.
    private static List<string> SplitSections(string note)
    {
        var starts = new List<int> { 0 };
        var next = note.IndexOf(SectionStart, StringComparison.Ordinal);

        while (next >= 0)
        {
            starts.Add(next);
            next = note.IndexOf(SectionStart, next + 1, StringComparison.Ordinal);
        }

        return starts.Select((start, index) => note[start..(index + 1 < starts.Count ? starts[index + 1] : note.Length)]).ToList();
    }

    private static string Heading(string section) => section.TrimStart('\n').Split('\n')[0].TrimStart('#', ' ');

    public static string KindLabel(ChatKind kind) => kind.ToString().ToLowerInvariant();

    private static string StartSteps(ChatBrief brief)
    {
        var steps = new List<string>();

        if (brief.Pbis.Count > 0)
            steps.Add(PbiContextStep(brief.Pbis));

        if (brief.ReadFirst.Count > 0)
            steps.Add("Read every note under Read first, and the code they cite where the briefing needs it.");

        steps.AddRange(brief.Before);

        if (brief.Briefing.Count > 0)
            steps.Add("Answer with a briefing for the user, in plain language, short, in this order:\n" + string.Join("\n", brief.Briefing.Select((part, index) => $"   {index + 1}. {part}")));

        steps.Add(brief.Ending);
        steps.AddRange(brief.AfterYes);

        return string.Join("\n", steps.Select((step, index) => $"{index + 1}. {step}"));
    }

    // The same prepared context the agents get, the user's own notes included; the notes under Read first stay the
    // fallback when the chat has no powerloom MCP server.
    private static string PbiContextStep(IReadOnlyList<int> pbis)
    {
        var calls = pbis.Select(adoId => $"`{Tool("pbi.read")}` with `{{\"ref\":\"PBI-{adoId}\"}}`");

        return $"Load the PBI's prepared context, the same the agents get (with the user's own notes): {string.Join(", ", calls)}. "
            + $"Read any reference it lists the same way (`{Tool("pbi.read")}` with that ref; see POWERLOOM.md). If the powerloom tools aren't there, say so and go on with the notes.";
    }

    private static string Context(ChatBrief brief)
    {
        var repos = brief.Repos.Count > 0 ? string.Join(", ", brief.Repos) + " (added to the session)" : "none";
        var skills = brief.Skills.Count > 0 ? string.Join(", ", brief.Skills.Select(skill => $"`{skill.Name}`{(string.IsNullOrWhiteSpace(skill.Reason) ? "" : $" ({skill.Reason})")}")) : "none";

        return $"- Repos: {repos}\n- Skills: {skills}";
    }

    private static string Frontmatter(string name, string title, ChatKind kind, string id, DateOnly today)
    {
        var lines = new[]
        {
            $"id: {JsonSerializer.Serialize(name)}",
            "type: \"chat\"",
            $"title: {JsonSerializer.Serialize(title)}",
            $"kind: \"{KindLabel(kind)}\"",
            "created_by: \"PowerLoom\"",
            $"updated: \"{today:yyyy-MM-dd}\"",
            $"tags: [\"PowerLoom\", \"chat\", \"{KindLabel(kind)}-{id}\"]",
        };

        return $"---\n{string.Join("\n", lines)}\n---";
    }

    private static string Bullets(IEnumerable<string> items)
    {
        var list = items.ToList();

        return list.Count > 0 ? string.Join("\n", list.Select(item => $"- {item}")) : "None.";
    }
}
