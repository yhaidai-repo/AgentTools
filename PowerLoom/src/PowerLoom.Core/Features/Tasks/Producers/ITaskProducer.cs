using System.Text.Json;
using PowerLoom.Contracts;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Features.Tasks.Producers;

// How scheduled tasks for one agent are made (user decision 2026-10-03): the check whether a task is needed now. An
// agent without a producer takes a goal on the vault's repos instead (user decision 2026-10-06).
public interface ITaskProducer
{
    string AgentId { get; }

    ItemKind Kind { get; }

    string Prefix { get; }

    // The task for this tick, saying whether it is needed; a problem when none can be made.
    Task<Outcome<ProducedTask>> ProduceAsync(string vault, JsonElement agentOptions, CancellationToken cancellation);
}
