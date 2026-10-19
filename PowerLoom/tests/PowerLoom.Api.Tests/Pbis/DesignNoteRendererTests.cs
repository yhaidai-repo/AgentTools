using PowerLoom.Features.Pbis.Notes;
using PowerLoom.Features.Pbis.Notes.Models;

namespace PowerLoom.Api.Tests.Pbis;

// The design note shows the estimate its run recorded with record_estimate; design may skip estimating.
public sealed class DesignNoteRendererTests
{
    [Fact]
    public void A_design_that_estimated_shows_both_values_and_the_basis()
    {
        var estimate = new EstimateNote("design", 1140, 12m, 3.5m, 3, "medium", "two services change");

        var text = DesignNoteRenderer.Render(Note(estimate), "");

        Assert.Contains("## Estimate\n\n| Human h | Agent h | Complexity | Confidence |\n|---|---|---|---|\n| 12 | 3.5 | 3/5 | medium |\n\nBasis: two services change", text);
    }

    [Fact]
    public void A_design_that_skipped_estimating_points_at_the_pbi_note()
    {
        var text = DesignNoteRenderer.Render(Note(null), "");

        Assert.Contains("## Estimate\n\nNot estimated in this run: the PBI note shows the PBI's latest estimate.", text);
    }

    [Fact]
    public void An_estimate_line_marks_a_refinement_estimate_without_agent_hours()
    {
        var estimate = new EstimateNote("refinement", null, 6m, null, null, null, "one form");

        Assert.Equal("6 h human, agent h not given (refinement): one form", PbiEstimates.Text(estimate));
    }

    private static DesignNote Note(EstimateNote? estimate) =>
        new(36756, 1, 1140, new DateTime(2026, 10, 18, 0, 0, 0, DateTimeKind.Utc), "Map the key to the vendor name.", [], [], [], [], [], estimate);
}
