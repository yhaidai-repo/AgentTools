using PowerLoom.Features.Pbis.Notes.Models;
using PowerLoom.Infrastructure.Backlog;

namespace PowerLoom.Features.Pbis.Notes;

public static class RefinementNoteRenderer
{
    public static string Render(RefinementNote note, string notesSection)
    {
        var pbi = $"[[{BacklogPaths.PbiNoteName(note.AdoId)}]]";
        var name = BacklogPaths.RefinementNoteName(note.AdoId);

        return string.Join("\n\n",
        [
            NoteText.Frontmatter(
            [
                ("id", name),
                ("type", "refinement"),
                ("title", $"Refinement v{note.Version}"),
                ("status", "final"),
                ("pbi", pbi),
                ("version", note.Version),
                ("run", note.RunId is null ? null : $"RUN-{note.RunId}"),
                ("created_by", "agent:refinement"),
                ("created", NoteText.IsoDate(note.Created)),
                ("updated", NoteText.IsoDate(note.Created)),
                ("tags", new[] { "adoa", $"pbi-{note.AdoId}", "refinement" }),
                ("related", new[] { pbi }),
            ]),
            $"# {name} Refinement v{note.Version}",
            $"PBI: {pbi}",
            "## Summary",
            note.Summary,
            "## Scope in",
            NoteText.Bullets(note.ScopeIn),
            "## Scope out",
            NoteText.Bullets(note.ScopeOut),
            "## Acceptance-criteria gaps",
            NoteText.Bullets(note.AcGaps.Select(item => $"{item.Gap} → _suggested:_ {item.Suggestion}")),
            "## Dependencies",
            NoteText.Bullets(note.Dependencies),
            "## Repos (assumption, to confirm)",
            NoteText.Bullets(note.Repos.Select(item => $"`{item.Name}`: {item.Reason}")),
            "## Assumptions",
            NoteText.Bullets(note.Assumptions),
            "## Relevant docs (for research and design)",
            NoteText.Bullets(note.RelevantDocs.Select(doc => $"`{doc.Path}`: {doc.Why}")),
            "## Docs read",
            NoteText.Bullets(note.DocsRead.Select(path => $"`{path}`")),
            notesSection,
        ]);
    }
}
