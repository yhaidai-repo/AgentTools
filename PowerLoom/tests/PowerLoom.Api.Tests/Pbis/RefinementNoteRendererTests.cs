using PowerLoom.Features.Pbis.Notes;
using PowerLoom.Features.Pbis.Notes.Models;

namespace PowerLoom.Api.Tests.Pbis;

// Better Refinement's details reach the PBI's refinement note; an earlier refinement's note stays as it was.
public sealed class RefinementNoteRendererTests
{
    private static readonly NoteEvidence Pbi = new("S0", "PBI-36756 description", "the symptom");

    [Fact]
    public void A_better_refinement_note_shows_status_sources_areas_test_data_blockers_and_next()
    {
        var details = new RefinementDetails(
            "complete",
            [new EvidencedText("PBI description and notes", [Pbi])],
            [new AffectedAreaNote("Billable Features report", "vendor column", [Pbi])],
            new TestDataNote(true, [], ["A tenant with SO transactions before June 2026"], "old data only"),
            [new BlockerNote("Is the null provider id real on QA2?", "HT-36756-004", [Pbi])],
            "The premise must be checked first.");

        var text = RefinementNoteRenderer.Render(Note(details), "");

        Assert.Contains("created_by: \"agent:better-refinement\"", text);
        Assert.Contains("## Affected areas\n\n- Billable Features report: vendor column (`PBI-36756 description`)", text);
        Assert.Contains("- Missing: A tenant with SO transactions before June 2026", text);
        Assert.Contains("- Is the null provider id real on QA2? → [[HT-36756-004]] (`PBI-36756 description`)", text);
        Assert.Contains("## Next\n\nThe premise must be checked first.", text);
        Assert.Contains("## Summary\n\nVendor shows as a raw key.\n\n## Estimate\n\n~6.5 h (developer): one report column", text);
    }

    [Fact]
    public void An_earlier_refinement_note_has_no_detail_sections_and_no_estimate()
    {
        var text = RefinementNoteRenderer.Render(Note(null, hours: null), "");

        Assert.Contains("created_by: \"agent:refinement\"", text);
        Assert.DoesNotContain("## Blockers", text);
        Assert.DoesNotContain("## Estimate", text);
    }

    private static RefinementNote Note(RefinementDetails? details, decimal? hours = 6.5m) =>
        new(36756, 2, 1133, new DateTime(2026, 10, 13, 0, 0, 0, DateTimeKind.Utc), "Vendor shows as a raw key.", [], [], [], [], [], [], [], [], hours, "one report column", details);
}
