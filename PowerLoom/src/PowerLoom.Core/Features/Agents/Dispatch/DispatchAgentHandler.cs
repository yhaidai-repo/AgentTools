using PowerLoom.Contracts.Confluence;
using PowerLoom.Contracts.Documents;
using PowerLoom.Domain.Tasks;
using PowerLoom.Features.Agents.AgentRun;
using PowerLoom.Features.Tasks;
using PowerLoom.Infrastructure.AgentConfig;
using PowerLoom.Infrastructure.AgentConfig.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using Wolverine;

namespace PowerLoom.Features.Agents.Dispatch;

// One dispatch at a time (the "dispatch" queue): the agent's open tasks in priority order, each through the validator;
// a held task keeps its reasons, a valid one is claimed and its run started, up to the agent's batch size.
public static class DispatchAgentHandler
{
    public const string Actor = "dispatch";

    public static async Task Handle(DispatchAgent message, PowerLoomDbContext db, AgentConfigReader agents, IMessageBus bus, ILogger<DispatchAgent> logger, CancellationToken cancellation)
    {
        var agent = await agents.ReadAsync(message.AgentId, cancellation);
        var skip = await SkipReasonAsync(agents, agent, cancellation);

        if (skip is not null || agent is null)
        {
            logger.LogInformation("dispatch {Agent}: skipped ({Reason})", message.AgentId, skip);

            return;
        }

        var tasks = await OpenAgentTasks.ListAsync(db, agent.Id, agent.Handles, cancellation);
        var started = 0;

        foreach (var task in tasks.TakeWhile(_ => started < agent.BatchSize))
            started += await TryStartAsync(db, bus, agent, task, cancellation) ? 1 : 0;

        logger.LogInformation("dispatch {Agent}: started {Started} of {Open} open task(s)", agent.Id, started, tasks.Count);
    }

    private static async Task<string?> SkipReasonAsync(AgentConfigReader agents, AgentSummary? agent, CancellationToken cancellation)
    {
        if (agent is null)
            return "not configured";

        if (!agent.Enabled)
            return "disabled";

        var global = await agents.GlobalAsync(cancellation);

        return global.IsPaused(DateTimeOffset.UtcNow) ? "agents paused" : null;
    }

    // The PBI's linked documents are collected and its Confluence pages checked when a task on it is about to start
    // (user decision 2026-10-02): a page still missing is fetched before the checks, and a valid task's pages are
    // brought to their current version.
    private static async Task<bool> TryStartAsync(PowerLoomDbContext db, IMessageBus bus, AgentSummary agent, LocalItem task, CancellationToken cancellation)
    {
        await CollectDocumentsAsync(bus, agent, task);
        await SyncPagesAsync(bus, task, PageSyncScope.Missing);

        var reasons = await TaskValidation.ValidateAsync(db, task, agent.Id, agent.WaitFor, agent.WebAccess, cancellation);

        if (reasons.Count > 0)
        {
            await TaskClaims.HoldAsync(db, task.Id, reasons, cancellation);

            return false;
        }

        await SyncPagesAsync(bus, task, PageSyncScope.All);

        if (!await TaskClaims.ClaimAsync(db, task.Id, Actor, cancellation))
            return false;

        await bus.PublishAsync(new AgentRunRequested(task.Id, agent.Id, task.PbiId, task.Vault, agent.TimeoutMinutes));
        await PbiChanges.PublishAsync(db, bus, task.PbiId, Actor, cancellation);

        return true;
    }

    private static async Task CollectDocumentsAsync(IMessageBus bus, AgentSummary agent, LocalItem task)
    {
        if (task.PbiId is not null)
            await bus.InvokeAsync(new CollectLinkedDocuments(task.Vault, task.PbiId.Value, AskForWebPages: !agent.WebAccess));
    }

    private static async Task SyncPagesAsync(IMessageBus bus, LocalItem task, PageSyncScope scope)
    {
        if (task.PbiId is not null)
            await bus.InvokeAsync(new SyncPbiPages(task.Vault, task.PbiId.Value, scope));
    }
}
