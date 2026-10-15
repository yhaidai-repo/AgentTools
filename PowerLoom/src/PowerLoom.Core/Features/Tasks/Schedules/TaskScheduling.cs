using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Domain.Pbis;
using PowerLoom.Domain.Tasks;
using PowerLoom.Features.Tasks.CreateTask;
using PowerLoom.Features.Tasks.CreateTask.Models;
using PowerLoom.Features.Tasks.Producers;
using PowerLoom.Features.Tasks.Schedules.Models;
using PowerLoom.Infrastructure.AgentConfig;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Features.Tasks.Schedules;

// Scheduled tasks (user decision 2026-10-03): a schedule's tick (or "Create now") creates its agent's task when one is
// needed; the agent's own cron decides when the task is picked up.
public sealed class TaskScheduling(PowerLoomDbContext db, IEnumerable<ITaskProducer> producers, AgentConfigReader agents, TaskCreation creation)
{
    private const int TitleMax = 120;
    private const string GoalPrefix = "GT";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    // Blocked counts too: a new task would fail the same way, so the user decides (Rerun or delete) first.
    private static readonly ItemStatus[] Waiting = [ItemStatus.Open, ItemStatus.InProgress, ItemStatus.Blocked];

    // An agent with a task producer takes no params; any other agent takes a goal and the vault's repos (user decision
    // 2026-10-06); a schedule by task type takes the task the task form describes (user decision 2026-10-14).
    public async Task<Outcome<TaskSchedule>> SaveAsync(ScheduleInput input, CancellationToken cancellation)
    {
        if (input.Name.Trim().Length == 0)
            return Outcome<TaskSchedule>.Failure(Problem.Invalid("A schedule needs a name."));

        var settings = input.TaskType is null ? await AgentSettingsAsync(input, cancellation) : await TypeSettingsAsync(input, cancellation);

        if (!settings.Ok)
            return Outcome<TaskSchedule>.Failure(settings.Problem);

        var row = input.Id is null ? db.TaskSchedules.Add(new TaskSchedule()).Entity : await db.TaskSchedules.SingleOrDefaultAsync(schedule => schedule.Id == input.Id, cancellation);

        if (row is null)
            return Outcome<TaskSchedule>.Failure(Problem.NotFound($"Schedule {input.Id} doesn't exist any more."));

        row.Name = input.Name.Trim();
        row.AgentId = settings.Value.AgentId;
        row.TaskType = settings.Value.TaskType;
        row.Vault = input.Vault;
        row.Cron = input.Cron.Trim();
        row.Enabled = input.Enabled;
        row.Params = settings.Value.Params;
        row.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellation);

        return Outcome<TaskSchedule>.Success(row);
    }

    private async Task<Outcome<ScheduleSettings>> AgentSettingsAsync(ScheduleInput input, CancellationToken cancellation)
    {
        var producer = ProducerFor(input.AgentId);
        var goal = new GoalParams(input.Goal?.Trim() ?? "", input.Repos ?? []);
        var problem = producer is null ? await goal.ProblemAsync(db, input.Vault, cancellation) : null;

        if (problem is not null)
            return Outcome<ScheduleSettings>.Failure(Problem.Invalid(problem));

        return Outcome<ScheduleSettings>.Success(new ScheduleSettings(input.AgentId, null, producer is null ? goal.ToJson() : "{}"));
    }

    // Checked as on the task form, except a waiting task of its type on the PBI: a tick reports that one.
    private async Task<Outcome<ScheduleSettings>> TypeSettingsAsync(ScheduleInput input, CancellationToken cancellation)
    {
        var pbiProblem = OptionalPbi.Parse(input.Pbi, out var pbiId);
        var task = new NewTask(input.Vault, input.TaskType!.Trim(), input.Name, input.Description ?? "", input.AcceptanceCriteria ?? "", pbiId, input.Repos ?? []);
        var problem = pbiProblem ?? await creation.ProblemAsync(task, cancellation);

        if (problem is not null)
            return Outcome<ScheduleSettings>.Failure(problem);

        return Outcome<ScheduleSettings>.Success(new ScheduleSettings(AgentStages.AnyAgentId, task.Type, TaskParams.From(task).ToJson()));
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

        if (schedule.TaskType is not null)
            return await CreateTypedTaskAsync(schedule, cancellation);

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

    // The schedule's task, as the task form described it; a refused one (e.g. a refinement still open on the PBI) is the
    // tick's result.
    private async Task<string> CreateTypedTaskAsync(TaskSchedule schedule, CancellationToken cancellation)
    {
        var created = await creation.CreateAsync(TaskParams.Of(schedule.Params).ToTask(schedule), cancellation);

        return created.Ok ? $"{created.Value.Id} created" : $"no task: {created.Problem.Detail}";
    }

    private Task<string?> WaitingTaskIdAsync(int scheduleId, CancellationToken cancellation)
    {
        return db.LocalItems.FromSql($"select * from local_item where (data->>'scheduleId')::int = {scheduleId}").Where(item => Waiting.Contains(item.Status)).Select(item => item.Id).FirstOrDefaultAsync(cancellation);
    }

    private async Task<string> InsertTaskAsync(TaskSchedule schedule, ITaskProducer producer, ProducedTask task, CancellationToken cancellation)
    {
        var id = await ItemIds.NextGlobalAsync(db, producer.Prefix, cancellation);
        var data = new Dictionary<string, object?>(task.Data) { ["scheduleId"] = schedule.Id, ["key"] = ScheduleKeys.Of(schedule.Id) };

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
        var data = new { goal = goal.Goal, repos = goal.Repos, scheduleId = schedule.Id, key = ScheduleKeys.Of(schedule.Id) };

        db.LocalItems.Add(new LocalItem { Id = id, Kind = ItemKind.Goal, PbiId = null, Vault = schedule.Vault, Title = Cut(schedule.Name), Status = ItemStatus.Open, Assignee = AgentStages.AssigneeOf(schedule.AgentId), Body = goal.Goal, Data = JsonSerializer.Serialize(data, Json), HeldBy = "[]" });

        await db.SaveChangesAsync(cancellation);

        return id;
    }

    private ITaskProducer? ProducerFor(string agentId) => producers.FirstOrDefault(producer => producer.AgentId == agentId);

    private static string Cut(string title) => title[..Math.Min(title.Length, TitleMax)];
}
