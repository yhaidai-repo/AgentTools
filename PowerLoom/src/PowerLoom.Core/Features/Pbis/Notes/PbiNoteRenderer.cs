using PowerLoom.Features.Pbis.Notes.Models;
using PowerLoom.Infrastructure.Backlog;

namespace PowerLoom.Features.Pbis.Notes;

// Frontmatter is always written by the app so metadata stays uniform; the body comes from the user's template.
// `regions` fills generated regions (refinement, items) with pipeline content.
public static class PbiNoteRenderer
{
    private const string EmptyText = "_Empty in Azure DevOps._";
    private const string NoCommentsText = "_No comments in Azure DevOps._";

    public static string Render(string template, PbiNote note, string notesSection, IReadOnlyDictionary<string, string> regions)
    {
        var body = NoteText.ReplaceRegions(PbiTemplate.Fill(template, Placeholders(note)), regions);

        return $"{Frontmatter(note)}\n\n{NotesSection.Before(body).TrimEnd()}\n\n{DiscussionSection(note.DiscussionMd)}{notesSection}";
    }

    // Written by the app like the frontmatter, not by the template, so it also reaches vaults whose template predates it.
    private static string DiscussionSection(string? discussionMd)
    {
        if (discussionMd is null)
            return "";

        var text = discussionMd.Length == 0 ? NoCommentsText : discussionMd;

        return $"## Discussion\n\n{text}\n\n";
    }

    private static Dictionary<string, string> Placeholders(PbiNote note)
    {
        return new Dictionary<string, string>
        {
            ["id"] = BacklogPaths.PbiNoteName(note.AdoId),
            ["ado_id"] = note.AdoId.ToString(),
            ["title"] = note.Title,
            ["ado_url"] = note.AdoUrl,
            ["ado_type"] = note.Type,
            ["ado_state"] = note.AdoState,
            ["status"] = note.PipelineStatus,
            ["iteration"] = note.IterationPath ?? NoteText.Empty,
            ["area"] = note.AreaPath ?? NoteText.Empty,
            ["assigned_to"] = note.AssignedTo ?? NoteText.Empty,
            ["priority"] = note.Priority?.ToString() ?? NoteText.Empty,
            ["tags"] = note.Tags.Count > 0 ? string.Join(", ", note.Tags) : NoteText.Empty,
            ["description"] = string.IsNullOrEmpty(note.DescriptionMd) ? EmptyText : note.DescriptionMd,
            ["acceptance_criteria"] = string.IsNullOrEmpty(note.AcceptanceCriteriaMd) ? EmptyText : note.AcceptanceCriteriaMd,
            ["created"] = NoteText.IsoDate(note.Created),
            ["updated"] = NoteText.IsoDate(note.Updated),
        };
    }

    private static string Frontmatter(PbiNote note)
    {
        var name = BacklogPaths.PbiNoteName(note.AdoId);
        var parent = note.ParentId is null ? null : $"[[{BacklogPaths.PbiNoteName(note.ParentId.Value)}]]";

        return NoteText.Frontmatter(
        [
            ("id", name),
            ("type", "pbi"),
            ("title", note.Title),
            ("status", note.PipelineStatus),
            ("ado_id", note.AdoId),
            ("ado_url", note.AdoUrl),
            ("ado_type", note.Type),
            ("ado_state", note.AdoState),
            ("iteration", note.IterationPath),
            ("priority", note.Priority),
            ("assigned_to", note.AssignedTo),
            ("created_by", "prepare"),
            ("created", NoteText.IsoDate(note.Created)),
            ("updated", NoteText.IsoDate(note.Updated)),
            ("parent", parent),
            ("tags", new[] { "powerloom", $"pbi-{note.AdoId}", "pbi" }),
            ("related", parent is null ? Array.Empty<string>() : [parent]),
        ]);
    }
}
