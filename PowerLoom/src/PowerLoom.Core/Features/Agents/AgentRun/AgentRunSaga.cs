using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PowerLoom.Domain.Tasks;
using PowerLoom.Features.Tasks;
using PowerLoom.Infrastructure.AgentConfig;
using PowerLoom.Infrastructure.Runner;
using PowerLoom.Infrastructure.Runner.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Enums;
using Wolverine;

namespace PowerLoom.Features.Agents.AgentRun;

// One claimed task from the request to the runner until its callback: the runner keeps everything inside the run
// (run row, attempts, blocked, the rate-limit pause); the saga does what comes after (hand-on, status, notes) and gives
// up a run without a callback. Identified by the task: a task is run once at a time.
public sealed class AgentRunSaga : Saga
{
    private const string Actor = "dispatch";

    public string Id { get; set; } = "";

    public string AgentId { get; set; } = "";

    public int? PbiId { get; set; }

    public Guid Attempt { get; set; }

    public DateTimeOffset? AcceptedAt { get; set; }

    public static (AgentRunSaga, OutgoingMessages) Start(AgentRunRequested message, IOptions<RunnerOptions> options)
    {
        var saga = new AgentRunSaga { Id = message.TaskId, AgentId = message.AgentId, PbiId = message.PbiId, Attempt = Guid.NewGuid() };
        var messages = new OutgoingMessages { new StartAgentRun(message.TaskId) };

        messages.Delay(new AgentRunTimedOut(message.TaskId, saga.Attempt), TimeSpan.FromMinutes(message.TimeoutMinutes) + options.Value.TimeoutMargin);

        return (saga, messages);
    }

    // A runner that is busy, or not up (restarting), is asked again later; the timeout is the backstop.
    public async Task<OutgoingMessages> Handle(StartAgentRun message, IRunnerClient runner, IOptions<RunnerOptions> options, ILogger<AgentRunSaga> logger, CancellationToken cancellation)
    {
        var answer = await AnswerAsync(runner, logger, cancellation);

        if (answer == RunnerAnswer.Accepted)
        {
            AcceptedAt = DateTimeOffset.UtcNow;
            logger.LogInformation("run {Task}: the runner started {Agent}", Id, AgentId);

            return [];
        }

        return [message.DelayedFor(options.Value.BusyRetry)];
    }

    public async Task Handle(AgentRunCompleted message, PowerLoomDbContext db, IMessageBus bus, ILogger<AgentRunSaga> logger, CancellationToken cancellation)
    {
        // No hand-on: agents create the next tasks themselves (create_task; user decision 2026-10-13).
        logger.LogInformation("run {Task}: {Agent} ended with {Outcome}{Error}", Id, AgentId, message.Outcome, message.Error is null ? "" : $" ({message.Error})");
        await PbiChanges.PublishAsync(db, bus, PbiId, Actor, cancellation);
        MarkCompleted();
    }

    public async Task Handle(AgentRunTimedOut message, PowerLoomDbContext db, IMessageBus bus, ILogger<AgentRunSaga> logger, CancellationToken cancellation)
    {
        if (message.Attempt != Attempt)
            return;

        var reason = AcceptedAt is null ? "the runner never accepted the task" : $"no answer from the runner since {AcceptedAt:u}";

        await TaskClaims.ReleaseAsync(db, Id, $"Timed out: {reason}", Actor, cancellation);
        await db.AgentRuns.Where(run => run.ItemId == Id && run.EndedAt == null)
            .ExecuteUpdateAsync(set => set.SetProperty(run => run.Outcome, RunOutcome.Timeout).SetProperty(run => run.Error, reason).SetProperty(run => run.EndedAt, DateTime.UtcNow), cancellation);
        logger.LogWarning("run {Task}: timed out ({Reason}); the task is open again", Id, reason);
        await PbiChanges.PublishAsync(db, bus, PbiId, Actor, cancellation);
        MarkCompleted();
    }

    // A callback or timeout after the saga ended (the runner answered after the timeout, or was restarted and recovered
    // the task itself): nothing to do.
    public static void NotFound(AgentRunCompleted message, ILogger<AgentRunSaga> logger)
    {
        logger.LogWarning("run {Task}: completed ({Outcome}) but no run is open for it", message.TaskId, message.Outcome);
    }

    public static void NotFound(AgentRunTimedOut message)
    {
    }

    public static void NotFound(StartAgentRun message)
    {
    }

    private async Task<RunnerAnswer> AnswerAsync(IRunnerClient runner, ILogger<AgentRunSaga> logger, CancellationToken cancellation)
    {
        try
        {
            return await runner.StartAsync(new RunnerRequest(Id, AgentId, PbiId), cancellation);
        }
        catch (HttpRequestException error)
        {
            logger.LogWarning("run {Task}: the runner is not reachable ({Error}); asking again later", Id, error.Message);

            return RunnerAnswer.Busy;
        }
    }

}
