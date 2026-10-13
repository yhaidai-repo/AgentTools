namespace PowerLoom.Persistence.Entities;

// An Azure DevOps Test Case linked to a PBI ("Tested By"), as the test case tool last read it (user decision 2026-10-13:
// test cases join the PBI's context). A case that tests several PBIs has a row per PBI.
public partial class TestCase
{
    public int PbiId { get; set; }

    public int AdoId { get; set; }

    public string Title { get; set; } = null!;

    public string State { get; set; } = null!;

    public int? Priority { get; set; }

    public int Rev { get; set; }

    // The steps as markdown (action, expected result), Shared Steps expanded in place.
    public string StepsMd { get; set; } = null!;

    // ADO's parameters and their data, as stored there; null when the case has none.
    public string? Parameters { get; set; }

    public DateTime FetchedAt { get; set; }

    public virtual WorkItem Pbi { get; set; } = null!;
}
