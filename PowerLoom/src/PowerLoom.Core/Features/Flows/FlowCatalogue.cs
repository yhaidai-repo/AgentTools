using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Domain.Tasks;
using PowerLoom.Features.Flows.Models;
using PowerLoom.Infrastructure.AgentConfig;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Vaults;

namespace PowerLoom.Features.Flows;

// The saved flows (PowerLoom Flow phase 1): a save checks the definition and bumps the version; a change applies to
// executions started after it (the running ones keep their snapshot).
public sealed class FlowCatalogue(PowerLoomDbContext db, AgentConfigReader agents)
{
    private const string IdPrefix = "FL";

    public async Task<Outcome<Flow>> SaveAsync(FlowInput input, CancellationToken cancellation)
    {
        var name = input.Name.Trim();

        if (name.Length == 0)
            return Failure(Problem.Invalid("A flow needs a name."));

        if (!await db.VaultExistsAsync(input.Vault, cancellation))
            return Failure(Problem.NotFound($"{input.Vault} isn't a vault."));

        var problem = FlowDefinitionRules.Check(input.Definition) ?? await FlowDefinitionRules.CheckAgentsAsync(input.Definition, agents, cancellation);

        if (problem is not null)
            return Failure(problem);

        var row = input.Id is null ? null : await db.Flows.SingleOrDefaultAsync(flow => flow.Id == input.Id, cancellation);

        if (input.Id is not null && row is null)
            return Failure(Problem.NotFound($"Flow {input.Id} doesn't exist any more."));

        if (row is not null && row.Vault != input.Vault)
            return Failure(Problem.Invalid($"Flow {row.Id} belongs to vault {row.Vault}; it can't move to {input.Vault}."));

        if (await db.Flows.AnyAsync(flow => flow.Vault == input.Vault && flow.Name == name && flow.Id != input.Id, cancellation))
            return Failure(Problem.Conflict($"Vault {input.Vault} already has a flow named \"{name}\"."));

        if (row is null)
            row = db.Flows.Add(new Flow { Id = await ItemIds.NextGlobalAsync(db, IdPrefix, cancellation), Vault = input.Vault, Version = 1, CreatedAt = DateTime.UtcNow }).Entity;
        else
            row.Version += 1;

        row.Name = name;
        row.Definition = FlowJson.Serialize(input.Definition);
        row.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellation);

        return Outcome<Flow>.Success(row);
    }

    // Takes the flow's finished executions with it (cascade); a running one keeps the flow.
    public async Task<Outcome<string>> DeleteAsync(string id, CancellationToken cancellation)
    {
        var flow = await db.Flows.SingleOrDefaultAsync(row => row.Id == id, cancellation);

        if (flow is null)
            return Outcome<string>.Failure(Problem.NotFound($"Flow {id} doesn't exist any more."));

        if (await db.FlowExecutions.AnyAsync(execution => execution.FlowId == id && execution.Status == FlowStatuses.Running, cancellation))
            return Outcome<string>.Failure(Problem.Conflict($"Flow {id} has a running execution; cancel it first."));

        db.Flows.Remove(flow);
        await db.SaveChangesAsync(cancellation);

        return Outcome<string>.Success(flow.Name);
    }

    public static SavedFlow Summary(Flow row) => new(row.Id, row.Vault, row.Name, row.Version, FlowJson.Parse(row.Definition), row.CreatedAt, row.UpdatedAt);

    private static Outcome<Flow> Failure(Problem problem) => Outcome<Flow>.Failure(problem);
}
