using System.Text.Json;
using PowerLoom.Features.Continue.Models;
using PowerLoom.Infrastructure.Backlog;

namespace PowerLoom.Features.Continue;

// The one chat note every kind gets (user decision 2026-10-10): the chat reads it and follows its Start section.
public static class ChatNote
{
    private static readonly string[] SharedRules =
    [
        "Azure DevOps is never written; nothing is pushed.",
        "The backlog vault is rendered by adoa: read it, don't edit it. This note's Notes section is the user's.",
    ];

    public static string Render(ChatBrief brief, ChatKind kind, string id, string launcherLabel, string notesSection, DateOnly today)
    {
        var name = $"chat-{KindLabel(kind)}-{id}";
        var parts = new List<string>
        {
            Frontmatter(name, brief.Title, kind, id, today),
            $"# {brief.Title}",
            $"Handoff for the {launcherLabel} chat adoa opened (\"Continue with {launcherLabel}\"). Paths are on the PC.",
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

    public static string KindLabel(ChatKind kind) => kind.ToString().ToLowerInvariant();

    private static string StartSteps(ChatBrief brief)
    {
        var steps = new List<string>();

        if (brief.ReadFirst.Count > 0)
            steps.Add("Read every note under Read first, and the code they cite where the briefing needs it.");

        steps.AddRange(brief.Before);

        if (brief.Briefing.Count > 0)
            steps.Add("Answer with a briefing for the user, in plain language, short, in this order:\n" + string.Join("\n", brief.Briefing.Select((part, index) => $"   {index + 1}. {part}")));

        steps.Add(brief.Ending);
        steps.AddRange(brief.AfterYes);

        return string.Join("\n", steps.Select((step, index) => $"{index + 1}. {step}"));
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
            "created_by: \"adoa\"",
            $"updated: \"{today:yyyy-MM-dd}\"",
            $"tags: [\"adoa\", \"chat\", \"{KindLabel(kind)}-{id}\"]",
        };

        return $"---\n{string.Join("\n", lines)}\n---";
    }

    private static string Bullets(IEnumerable<string> items)
    {
        var list = items.ToList();

        return list.Count > 0 ? string.Join("\n", list.Select(item => $"- {item}")) : "None.";
    }
}
