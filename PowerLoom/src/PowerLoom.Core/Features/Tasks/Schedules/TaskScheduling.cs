using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Domain.Pbis;
using PowerLoom.Domain.Tasks;
using PowerLoom.Features.Tasks.Producers;
using PowerLoom.Features.Tasks.Schedules.Models;
using PowerLoom.Infrastructure.AgentConfig;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Features.Tasks.Schedules;

// Scheduled tasks (user decision 2026-10-03): a schedule's tick (or "Create now") creates its agent's task when one is
// needed; the agent's own cron decides when the task is picked up.
public sealed class TaskScheduling(PowerLoomDbContext db, IEnumerable<ITaskProducer> producers, AgentConfigReader agents)
{
    private const int TitleMax = 120;
    private const string GoalPrefix = "GT";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    // Blocked counts too: a new task would fail the same way, so the user decides (Rerun or delete) first.
    private static readonly ItemStatus[] Waiting = [ItemStatus.Open, ItemStatus.InProgress, ItemStatus.Blocked];

    // An agent with a task producer takes no params; any other agent takes a goal and the vault's repos (user decision
    // 2026-10-06).
    public async Task<Outcome<TaskSchedule>> SaveAsync(ScheduleInput input, CancellationToken cancellation)
    {
        var producer = ProducerFor(input.AgentId);
        var goal = new GoalParams(input.Goal?.Trim() ?? "", input.Repos ?? []);
        var problem = input.Name.Trim().Length == 0 ? "A schedule needs a name." : producer is null ? await goal.ProblemAsync(db, input.Vault, cancellation) : null;

        if (problem is not null)
            return Outcome<TaskSchedule>.Failure(Problem.Invalid(problem));

        var row = input.Id is null ? db.TaskSchedules.Add(new TaskSchedule()).Entity : await db.TaskSchedules.SingleOrDefaultAsync(schedule => schedule.Id == input.Id, cancellation);

        if (row is null)
            return Outcome<TaskSchedule>.Failure(Problem.NotFound($"Schedule {input.Id} doesn't exist any more."));

        row.Name = input.Name.Trim();
        row.AgentId = input.AgentId;
        row.Vault = input.Vault;
        row.Cron = input.Cron.Trim();
        row.Enabled = input.Enabled;
        row.Params = producer is null ? goal.ToJson() : "{}";
        row.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellation);

        return Outcome<TaskSchedule>.Success(row);
    }

    public Task DeleteAsync(int id, CancellationToken cancellation) => db.TaskSchedules.Where(schedule => schedule.Id == id).ExecuteDeleteAsync(cancellation);

    // One tick: the schedule's task, only when needed (user decision 2026-10-03): none of its tasks waits, and the
    // producer says there is work. "Create now" (`force`) goes past the producer's check, never past a waiting task.
    // Returns what happened, also kept on the schedule for the Tasks page.
    public async Task<string> TickAsync(TaskSchedule schedule, bool force, CancellationToken cancellation)
    {
        var result = await TickResultAsync(schedule, force, cancellation);

        schedule.LastRunAt = DateTime.UtcNow;
        schedule.LastResult = result;

        await db.SaveChangesAsync(cancellation);

        return result;
    }

    private async Task<string> TickResultAsync(TaskSchedule schedule, bool force, CancellationToken cancellation)
    {
        var waiting = await WaitingTaskIdAsync(schedule.Id, cancellation);

        if (waiting is not null)
            return $"{waiting} still waits; no new task";

        var producer = ProducerFor(schedule.AgentId);

        // A goal task is always wanted when none waits; the agent's result says what it found.
        if (producer is null)
            return $"{await InsertGoalTaskAsync(schedule, cancellation)} created";

        var agent = await agents.ReadAsync(schedule.AgentId, cancellation);
        var produced = await producer.ProduceAsync(schedule.Vault, agent?.Options ?? JsonDocument.Parse("{}").RootElement, cancellation);

        if (!produced.Ok)
            return $"no task: {produced.Problem!.Detail}";

        var skipReason = force ? null : produced.Value!.NotNeeded;

        return skipReason is not null ? $"no task: {skipReason}" : $"{await InsertTaskAsync(schedule, producer, produced.Value!, cancellation)} created";
    }

    private Task<string?> WaitingTaskIdAsync(int scheduleId, CancellationToken cancellation)
    {
        return db.LocalItems.FromSql($"select * from local_item where (data->>'scheduleId')::int = {scheduleId}").Where(item => Waiting.Contains(item.Status)).Select(item => item.Id).FirstOrDefaultAsync(cancellation);
    }

    private async Task<string> InsertTaskAsync(TaskSchedule schedule, ITaskProducer producer, ProducedTask task, CancellationToken cancellation)
    {
        var id = await ItemIds.NextGlobalAsync(db, producer.Prefix, cancellation);
        var data = new Dictionary<string, object?>(task.Data) { ["scheduleId"] = schedule.Id, ["key"] = Key(schedule) };

        db.LocalItems.Add(new LocalItem { Id = id, Kind = producer.Kind, PbiId = null, Title = Cut(task.Title), Status = ItemStatus.Open, Assignee = AgentStages.AssigneeOf(schedule.AgentId), Vault = schedule.Vault, Body = task.Body, Data = JsonSerializer.Serialize(data, Json), HeldBy = "[]" });

        await db.SaveChangesAsync(cancellation);

        return id;
    }

    // The tick's task: the schedule's goal and repos, for the schedule's agent; its resolution is the agent's written
    // result.
    private async Task<string> InsertGoalTaskAsync(TaskSchedule schedule, CancellationToken cancellation)
    {
        var id = await ItemIds.NextGlobalAsync(db, GoalPrefix, cancellation);
        var goal = GoalParams.Of(schedule.Params);
        var data = new { goal = goal.Goal, repos = goal.Repos, scheduleId = schedule.Id, key = Key(schedule) };

        db.LocalItems.Add(new LocalItem { Id = id, Kind = ItemKind.Goal, PbiId = null, Vault = schedule.Vault, Title = Cut(schedule.Name), Status = ItemStatus.Open, Assignee = AgentStages.AssigneeOf(schedule.AgentId), Body = goal.Goal, Data = JsonSerializer.Serialize(data, Json), HeldBy = "[]" });

        await db.SaveChangesAsync(cancellation);

        return id;
    }

    private ITaskProducer? ProducerFor(string agentId) => producers.FirstOrDefault(producer => producer.AgentId == agentId);

    private static string Key(TaskSchedule schedule) => $"schedule:{schedule.Id}:{DateTime.UtcNow:O}";

    private static string Cut(string title) => title[..Math.Min(title.Length, TitleMax)];
}
