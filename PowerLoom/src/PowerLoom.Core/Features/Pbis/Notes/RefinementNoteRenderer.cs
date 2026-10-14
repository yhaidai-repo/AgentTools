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
                ("created_by", note.Details is null ? "agent:refinement" : "agent:better-refinement"),
                ("created", NoteText.IsoDate(note.Created)),
                ("updated", NoteText.IsoDate(note.Created)),
                ("tags", new[] { "powerloom", $"pbi-{note.AdoId}", "refinement" }),
                ("related", new[] { pbi }),
            ]),
            $"# {name} Refinement v{note.Version}",
            $"PBI: {pbi}",
            "## Summary",
            note.Summary,
            .. EstimateSection(note.EstHours, note.EstimateBasis),
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
            .. DetailSections(note.Details),
            notesSection,
        ]);
    }

    // A rough figure for planning; design estimates the plan it writes.
    public static string? EstimateText(decimal? hours, string? basis)
    {
        if (hours is null)
            return null;

        return $"~{hours.Value.ToString("0.#", System.Globalization.CultureInfo.InvariantCulture)} h (developer): {basis}";
    }

    private static IEnumerable<string> EstimateSection(decimal? hours, string? basis)
    {
        var text = EstimateText(hours, basis);

        return text is null ? [] : ["## Estimate", text];
    }

    // Better Refinement's details; an earlier refinement has none, so its note stays as it was.
    private static IEnumerable<string> DetailSections(RefinementDetails? details)
    {
        if (details is null)
            return [];

        return
        [
            "## Status",
            details.Status,
            "## Sources",
            NoteText.Bullets(details.Sources.Select(source => $"{source.What}{Refs(source.Evidence)}")),
            "## Affected areas",
            NoteText.Bullets(details.AffectedAreas.Select(area => $"{area.Area}: {area.Change}{Refs(area.Evidence)}")),
            "## Test data",
            TestDataText(details.TestData),
            "## Blockers",
            NoteText.Bullets(details.Blockers.Select(blocker => $"{blocker.What} → [[{blocker.ResolvedBy}]]{Refs(blocker.Evidence)}")),
            "## Next",
            details.NextReason,
        ];
    }

    private static string TestDataText(TestDataNote testData)
    {
        if (!testData.Applicable)
            return $"Not needed: {testData.Reason}";

        var given = testData.Given.Select(item => $"Given: {item.What}{Refs(item.Evidence)}");
        var missing = testData.Missing.Select(item => $"Missing: {item}");

        return NoteText.Bullets(given.Concat(missing));
    }

    private static string Refs(IReadOnlyList<NoteEvidence> evidence) => evidence.Count == 0 ? "" : $" ({string.Join("; ", evidence.Select(item => $"`{item.Ref}`"))})";
}
