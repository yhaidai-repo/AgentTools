using PowerLoom.Features.Pbis.Notes.Models;
using PowerLoom.Infrastructure.Backlog;

namespace PowerLoom.Features.Pbis.Notes;

public static class ResultNoteRenderer
{
    public static string Render(ResultNote note, string notesSection)
    {
        var pbi = $"[[{BacklogPaths.PbiNoteName(note.AdoId)}]]";
        var name = BacklogPaths.ResultNoteName(note.Id, note.RunId);
        var task = note.TaskId is null ? null : $"[[{note.TaskId}]]";

        return string.Join("\n\n",
        [
            NoteText.Frontmatter(
            [
                ("id", name),
                ("type", "result"),
                ("title", Summary(note.Body)),
                ("status", note.Status),
                ("pbi", pbi),
                ("task", task),
                ("run", note.RunId is null ? null : $"RUN-{note.RunId}"),
                ("agent", note.Agent),
                ("created_by", $"agent:{note.Agent}"),
                ("created", NoteText.IsoDate(note.Created)),
                ("updated", NoteText.IsoDate(note.Created)),
                ("tags", new[] { "powerloom", $"pbi-{note.AdoId}", "result" }),
                ("related", task is null ? new[] { pbi } : new[] { pbi, task }),
            ]),
            $"# {name} {Summary(note.Body)}",
            $"PBI: {pbi}{(task is null ? "" : $" · Task: {task}")} · Agent: {note.Agent} · Status: {note.Status}",
            note.Body,
            "## Evidence",
            note.Evidence.Count == 0 ? "–" : NoteText.Bullets(note.Evidence.Select(EvidenceLine)),
            notesSection,
        ]);
    }

    // The body's first non-empty line, without a heading marker.
    private static string Summary(string body)
    {
        var line = body.Split('\n').Select(item => item.Trim()).FirstOrDefault(item => item.Length > 0) ?? "-";

        return line.TrimStart('#').Trim();
    }

    private static string EvidenceLine(ResultEvidence item)
    {
        return item.Quote is null ? $"`{item.Ref}`: {item.Note}" : $"`{item.Ref}`: {item.Note} — \"{item.Quote}\"";
    }
}
