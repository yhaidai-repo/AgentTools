namespace PowerLoom.Persistence.Entities;

// Every estimate an agent recorded with record_estimate, one per run (user decision 2026-10-18); a PBI shows its latest,
// from any agent. Human h = a developer without an agent; agent h = an agent implementing it (user decision 2026-10-02).
public partial class PbiEstimate
{
    public int Id { get; set; }

    public int PbiId { get; set; }

    // Null once the run is deleted: the estimate stays as the PBI's history.
    public long? RunId { get; set; }

    // The agent id, e.g. better-refinement.
    public string Agent { get; set; } = null!;

    public decimal HumanHours { get; set; }

    // Null only for refinement estimates from before record_estimate (backfilled history).
    public decimal? AgentHours { get; set; }

    public short? Complexity { get; set; }

    public string? Confidence { get; set; }

    public string Basis { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public virtual WorkItem Pbi { get; set; } = null!;

    public virtual AgentRun? Run { get; set; }
}
