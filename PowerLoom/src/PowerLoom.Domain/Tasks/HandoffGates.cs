using Microsoft.EntityFrameworkCore;
using PowerLoom.Domain.Tasks.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;

namespace PowerLoom.Domain.Tasks;

// Gated dependencies (hand-off v1, user decision 2026-10-28): a task that depends on an item a hand-off gates starts only
// as the gate allows, unlike TaskDependencies' any-close release. `approve`: the review human task closed done with
// `approve` as its first answer; `answer`: an answered question or a done human task. Anything else is a refusal the
// dispatcher blocks the task with, worded so the receiving agent and the person can act on it.
public static class HandoffGates
{
    private const string Approve = "approve";
    private const string Answer = "answer";
    private const string FirstAnswerHeading = "### 1.";
    private const string NextHeading = "\n### ";

    private static readonly string[] Answered = ["answered", "done"];

    public static async Task<List<string>> RefusalsAsync(PowerLoomDbContext db, LocalItem task, CancellationToken cancellation)
    {
        var dependencies = ItemData.StringsOf(task.Data, "dependsOn");

        if (dependencies.Count == 0)
            return [];

        var gated = await ClosedGatedAsync(db, dependencies.ToArray(), cancellation);

        return gated.Select(RefusalOf).OfType<string>().ToList();
    }

    // Only closed targets: an open one still holds the task as a plain dependency.
    private static Task<List<GatedDependency>> ClosedGatedAsync(PowerLoomDbContext db, string[] dependencies, CancellationToken cancellation) =>
        db.Database.SqlQuery<GatedDependency>($"""
            select h.to_item_id as "ItemId", h.gate as "Gate", i.status::text as "Status", i.resolution as "Resolution"
            from handoff h join local_item i on i.id = h.to_item_id
            where h.gate <> 'none' and h.status = 'closed' and h.to_item_id = any({dependencies})
            order by h.to_item_id
            """).ToListAsync(cancellation);

    public static string? RefusalOf(GatedDependency dependency) => dependency.Gate switch
    {
        Approve => ApprovalRefusal(dependency),
        Answer => Answered.Contains(dependency.Status) ? null : $"{dependency.ItemId} was {dependency.Status} without an answer",
        _ => null,
    };

    private static string? ApprovalRefusal(GatedDependency dependency)
    {
        if (dependency.Status != "done")
            return $"{dependency.ItemId} was {dependency.Status}: the review never approved it";

        var decision = FirstAnswerOf(dependency.Resolution);

        if (IsApproval(decision))
            return null;

        return string.IsNullOrEmpty(decision) ? $"{dependency.ItemId} closed without a review decision" : $"{dependency.ItemId} asked for changes: {decision}";
    }

    // The review's step 1 answer, as core's humanTaskResolution writes it: `### 1. <action>`, a blank line, the answer.
    public static string FirstAnswerOf(string? resolution)
    {
        var start = resolution?.IndexOf(FirstAnswerHeading, StringComparison.Ordinal) ?? -1;

        if (start < 0)
            return "";

        var body = resolution![start..];
        var answerStart = body.IndexOf("\n\n", StringComparison.Ordinal);

        if (answerStart < 0)
            return "";

        var answer = body[(answerStart + 2)..];
        var end = answer.IndexOf(NextHeading, StringComparison.Ordinal);

        return (end < 0 ? answer : answer[..end]).Trim();
    }

    private static bool IsApproval(string decision)
    {
        var word = decision.TrimEnd('.', '!', ' ').ToLowerInvariant();

        return word is Approve or "approved";
    }
}
