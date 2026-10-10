using System.Text.Json;
using PowerLoom.Contracts;
using PowerLoom.Infrastructure.VaultScan;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Features.Tasks.Producers;

// The vault review (user decision 2026-10-03): a task only when the schedule's vault has candidates. The schedule
// belongs to one vault (user decision 2026-10-06: created from that vault's Maintenance tab).
public sealed class VaultReviewProducer(PowerLoomDbContext db, VaultScanner scanner) : ITaskProducer
{
    public const string Agent = "vault-review";

    public string AgentId => Agent;

    public ItemKind Kind => ItemKind.VaultReview;

    public string Prefix => "VR";

    public async Task<Outcome<ProducedTask>> ProduceAsync(string vault, JsonElement agentOptions, CancellationToken cancellation)
    {
        var index = await scanner.ScanAsync(vault, cancellation);
        var count = await VaultReviewCandidates.CountAsync(db, index, StaleDays(agentOptions), DateTime.UtcNow, cancellation);

        return Outcome<ProducedTask>.Success(ReviewTask(vault, count));
    }

    // From the agent's Config options, so this count and the agent's lists use the same values.
    private static int StaleDays(JsonElement options)
    {
        return options.ValueKind == JsonValueKind.Object && options.TryGetProperty("staleDays", out var value) && value.ValueKind == JsonValueKind.Number ? value.GetInt32() : VaultReviewCandidates.DefaultStaleDays;
    }

    // The task names its vault in `data.vaults`, as the agent's executor reads it.
    private static ProducedTask ReviewTask(string vault, int count)
    {
        var data = new Dictionary<string, object?> { ["vaults"] = new[] { vault }, ["counts"] = new Dictionary<string, int> { [vault] = count } };

        return new ProducedTask(
            $"Review the vault {vault}: {count} candidate(s)",
            $"Candidates (stale or unlinked notes, dead links, open records) when the task was created: {count}.",
            data,
            count == 0 ? $"nothing to review in {vault}" : null);
    }
}
