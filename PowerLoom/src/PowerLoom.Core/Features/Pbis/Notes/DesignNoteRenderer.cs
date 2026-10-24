using System.Globalization;
using PowerLoom.Features.Pbis.Notes.Models;
using PowerLoom.Infrastructure.Backlog;

namespace PowerLoom.Features.Pbis.Notes;

public static class DesignNoteRenderer
{
    public static string Render(DesignNote note, string notesSection)
    {
        var pbi = $"[[{BacklogPaths.PbiNoteName(note.AdoId)}]]";
        var name = BacklogPaths.DesignNoteName(note.AdoId);

        return string.Join("\n\n",
        [
            NoteText.Frontmatter(
            [
                ("id", name),
                ("type", "design"),
                ("title", $"Design v{note.Version}"),
                ("status", "final"),
                ("pbi", pbi),
                ("version", note.Version),
                ("run", note.RunId is null ? null : $"RUN-{note.RunId}"),
                ("created_by", "agent:design"),
                ("created", NoteText.IsoDate(note.Created)),
                ("updated", NoteText.IsoDate(note.Created)),
                ("tags", new[] { "powerloom", $"pbi-{note.AdoId}", "design" }),
                ("related", new[] { pbi }),
            ]),
            $"# {name} Design v{note.Version}",
            $"PBI: {pbi}",
            "## Approach",
            note.Approach,
            "## Estimate",
            EstimateTable(note.Estimate),
            "## Alternatives",
            NoteText.Bullets(note.Alternatives.Select(item => $"**{item.Option}**: pros {JoinOrNone(item.Pros)}; cons {JoinOrNone(item.Cons)}. _Not chosen:_ {item.WhyNot}")),
            "## Plan",
            PlanTable(note),
            "## Risks",
            NoteText.Bullets(note.Risks.Select(item => $"{item.Risk} ({item.Impact}) → _mitigation:_ {item.Mitigation}")),
            "## Tests",
            NoteText.Bullets(note.Tests.Select(item => $"{item.Kind}: {item.Case}")),
            "## Assumptions",
            NoteText.Bullets(note.Assumptions),
            notesSection,
        ]);
    }

    // The estimate this design's run recorded; the PBI note shows the PBI's latest from any agent.
    private static string EstimateTable(EstimateNote? estimate)
    {
        if (estimate is null)
            return "Not estimated in this run: the PBI note shows the PBI's latest estimate.";

        return string.Join("\n",
        [
            "| Human h | Agent h | Complexity | Confidence |",
            "|---|---|---|---|",
            $"| {PbiEstimates.Number(estimate.HumanHours)} | {Number(estimate.AgentHours)} | {estimate.Complexity?.ToString() ?? NoteText.Empty}/5 | {estimate.Confidence ?? NoteText.Empty} |",
            "",
            $"Basis: {(string.IsNullOrEmpty(estimate.Basis) ? NoteText.Empty : estimate.Basis)}",
        ]);
    }

    private static string PlanTable(DesignNote note)
    {
        var rows = note.Plan.Select((step, index) =>
            $"| {index + 1} | {NoteText.EscapeCell(step.Step)} | {NoteText.EscapeCell(step.Repo)} | {NoteText.EscapeCell(string.Join(", ", step.Locations ?? []))} | {NoteText.EscapeCell(step.Change)} | {(step.AgentDoable ? "yes" : "no")} |");

        return string.Join("\n", new[] { "| # | Step | Repo | Where | Change | Agent |", "|---|---|---|---|---|---|" }.Concat(rows));
    }

    private static string JoinOrNone(string[]? items) => items is { Length: > 0 } ? string.Join("; ", items) : "none";

    private static string Number(decimal? value) => value?.ToString(CultureInfo.InvariantCulture) ?? NoteText.Empty;
}
