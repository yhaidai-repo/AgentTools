using System.Text.Json;
using PowerLoom.Features.Pbis.Notes.Models;
using PowerLoom.Infrastructure.Backlog;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Features.Pbis.Notes;

public static class ItemNoteRenderer
{
    private static readonly KebabCaseNameTranslator Labels = new();

    private static readonly Dictionary<ItemKind, string> NoteTypes = new()
    {
        [ItemKind.Research] = "research-task",
        [ItemKind.Design] = "design-task",
        [ItemKind.Human] = "human-task",
        [ItemKind.Question] = "question",
        [ItemKind.ResearchResult] = "research-result",
    };

    public static string Render(ItemNote item, string notesSection)
    {
        var pbi = $"[[{BacklogPaths.PbiNoteName(item.AdoId)}]]";
        var parentLink = item.ParentId is null ? "" : $" · From: [[{item.ParentId}]]";
        var noteType = NoteTypes.GetValueOrDefault(item.Kind, Labels.TranslateMemberName(item.Kind.ToString()));
        var parts = new List<string>
        {
            NoteText.Frontmatter(
            [
                ("id", item.Id),
                ("type", noteType),
                ("title", item.Title),
                ("status", item.Status),
                ("pbi", pbi),
                ("parent", item.ParentId is null ? null : $"[[{item.ParentId}]]"),
                ("assignee", item.Assignee),
                ("run", item.RunId is null ? null : $"RUN-{item.RunId}"),
                ("created_by", item.ParentId is null ? "agent:refinement" : "agent:research"),
                ("created", NoteText.IsoDate(item.Created)),
                ("updated", NoteText.IsoDate(item.Updated)),
                ("tags", new[] { "powerloom", $"pbi-{item.AdoId}", noteType }),
                ("related", new[] { pbi }),
            ]),
            $"# {item.Id} {item.Title}",
            $"PBI: {pbi}{parentLink} · Status: {item.Status} · Assignee: {item.Assignee}",
        };

        parts.AddRange(Sections(item));
        parts.Add(notesSection);

        return string.Join("\n\n", parts);
    }

    private static IEnumerable<string> Sections(ItemNote item)
    {
        return item.Kind switch
        {
            ItemKind.Question => QuestionSections(item),
            ItemKind.Human => HumanTaskSections(item),
            ItemKind.ResearchResult => ResearchResultSections(item),
            _ => TaskSections(item),
        };
    }

    private static IEnumerable<string> TaskSections(ItemNote item)
    {
        var repos = Strings(item, "repos").Select(name => $"- `{name}`");

        return ["## Question", item.Body ?? NoteText.Empty, "## Goal", Text(item, "goal"), "## Repos", JoinOrNone(repos)];
    }

    private static IEnumerable<string> HumanTaskSections(ItemNote item)
    {
        return new[] { "## Task", item.Body ?? NoteText.Empty }.Concat(ClosedSection(item, "## Outcome", "_Close it on the PBI's page in PowerLoom._"));
    }

    private static IEnumerable<string> QuestionSections(ItemNote item)
    {
        var options = Strings(item, "options").Select(option => $"- {option}");

        return new[]
        {
            "## Question", item.Body ?? NoteText.Empty,
            "## Why it matters", Text(item, "why"),
            "## Options", JoinOrNone(options, "None given."),
        }.Concat(ClosedSection(item, "## Answer", "_Answer on the PBI's page in PowerLoom._"));
    }

    // Open items say where to close them; closed ones show what the person answered and uploaded.
    private static IEnumerable<string> ClosedSection(ItemNote item, string heading, string openHint)
    {
        if (item.Status == "open")
            return [openHint];

        var files = item.Attachments.Select(name => $"- [[{name}]]").ToList();
        var parts = new List<string> { heading, $"{item.Status}: {item.Resolution ?? NoteText.Empty}" };

        if (files.Count > 0)
            parts.Add(string.Join("\n", files));

        return parts;
    }

    private static IEnumerable<string> ResearchResultSections(ItemNote item)
    {
        var evidence = Objects(item, "evidence").Select(entry => $"- `{Property(entry, "location")}`: {Property(entry, "note")}");
        var docs = Objects(item, "relevantDocs").Select(doc => $"- `{Property(doc, "path")}`: {Property(doc, "why")}");
        var code = Objects(item, "codeRefs").Select(reference => $"- `{Property(reference, "location")}`: {Property(reference, "why")}");
        var commits = Commits(item).Select(commit => $"- {commit.Repo} @ `{commit.Sha[..Math.Min(commit.Sha.Length, 10)]}`");

        return
        [
            "## Conclusion", item.Body ?? NoteText.Empty,
            $"Confidence: **{Text(item, "confidence")}**",
            "## Findings", JoinOrNone(Strings(item, "findings").Select(finding => $"- {finding}")),
            "## Evidence", JoinOrNone(evidence),
            "## For design: docs", JoinOrNone(docs),
            "## For design: code", JoinOrNone(code),
            "## Code version read", JoinOrNone(commits, "No repos."),
        ];
    }

    private static IEnumerable<(string Repo, string Sha)> Commits(ItemNote item)
    {
        if (item.Data is not { } data || !data.TryGetProperty("commits", out var commits) || commits.ValueKind != JsonValueKind.Object)
            return [];

        return commits.EnumerateObject().Select(entry => (entry.Name, entry.Value.GetString() ?? "")).ToList();
    }

    private static string Text(ItemNote item, string field)
    {
        if (item.Data is not { } data || !data.TryGetProperty(field, out var value) || value.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
            return NoteText.Empty;

        return value.ValueKind == JsonValueKind.String ? value.GetString() ?? NoteText.Empty : value.GetRawText();
    }

    private static IEnumerable<string> Strings(ItemNote item, string field) => Elements(item, field).Select(element => element.ValueKind == JsonValueKind.String ? element.GetString() ?? "" : element.GetRawText());

    private static IEnumerable<JsonElement> Objects(ItemNote item, string field) => Elements(item, field).Where(element => element.ValueKind == JsonValueKind.Object);

    private static IEnumerable<JsonElement> Elements(ItemNote item, string field)
    {
        if (item.Data is not { } data || !data.TryGetProperty(field, out var value) || value.ValueKind != JsonValueKind.Array)
            return [];

        return value.EnumerateArray().ToList();
    }

    private static string Property(JsonElement element, string name) => element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() ?? "" : "";

    private static string JoinOrNone(IEnumerable<string> lines, string none = "None.")
    {
        var list = lines.ToList();

        return list.Count > 0 ? string.Join("\n", list) : none;
    }
}
