using System.Globalization;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Features.Pbis.Notes.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;

namespace PowerLoom.Features.Pbis.Notes;

// The agents' estimates (record_estimate): the PBI note shows the PBI's latest from any agent (user decision 2026-10-18),
// a refinement or design note the one its own run recorded.
public static class PbiEstimates
{
    public static async Task<EstimateNote?> LatestAsync(PowerLoomDbContext db, int adoId, CancellationToken cancellation)
    {
        var latest = await NewestFirst(db.PbiEstimates.AsNoTracking().Where(row => row.PbiId == adoId)).FirstOrDefaultAsync(cancellation);

        return ToNote(latest);
    }

    // None for a run that didn't estimate (design may skip it).
    public static async Task<EstimateNote?> OfRunAsync(PowerLoomDbContext db, long? runId, CancellationToken cancellation)
    {
        if (runId is null)
            return null;

        var latest = await NewestFirst(db.PbiEstimates.AsNoTracking().Where(row => row.RunId == runId)).FirstOrDefaultAsync(cancellation);

        return ToNote(latest);
    }

    // One line, e.g. "12 h human, 3 h agent, complexity 3/5, confidence medium (design, RUN-41): two services change".
    public static string Text(EstimateNote estimate)
    {
        var parts = new List<string> { $"{Number(estimate.HumanHours)} h human", AgentHoursText(estimate.AgentHours) };

        if (estimate.Complexity is not null)
            parts.Add($"complexity {estimate.Complexity}/5");

        if (estimate.Confidence is not null)
            parts.Add($"confidence {estimate.Confidence}");

        return $"{string.Join(", ", parts)} ({Source(estimate)}): {estimate.Basis}";
    }

    public static string Number(decimal hours) => hours.ToString("0.#", CultureInfo.InvariantCulture);

    private static string AgentHoursText(decimal? hours) => hours is null ? "agent h not given" : $"{Number(hours.Value)} h agent";

    private static string Source(EstimateNote estimate) => estimate.RunId is null ? estimate.Agent : $"{estimate.Agent}, RUN-{estimate.RunId}";

    private static IQueryable<PbiEstimate> NewestFirst(IQueryable<PbiEstimate> rows) => rows.OrderByDescending(row => row.CreatedAt).ThenByDescending(row => row.Id);

    private static EstimateNote? ToNote(PbiEstimate? row) =>
        row is null ? null : new EstimateNote(row.Agent, row.RunId, row.HumanHours, row.AgentHours, row.Complexity, row.Confidence, row.Basis);
}
