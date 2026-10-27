using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Domain.Pbis;
using PowerLoom.Features.Tasks.CreateTask;
using PowerLoom.Features.Tasks.CreateTask.Models;
using PowerLoom.Features.Tasks.Schedules.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Vaults;
using Wolverine;

namespace PowerLoom.Features.Tasks.Schedules;

// Scheduled tasks (user decision 2026-10-03): a schedule's tick (or "Create now") creates the task the task form described,
// for any agent that takes its type (user decision 2026-10-14; the vault review too since 2026-10-18). The agent's own
// cron decides when the task is picked up.
public sealed class TaskScheduling(PowerLoomDbContext db, TaskCreation creation, IMessageBus bus)
{
    // Blocked counts too: a new task would fail the same way, so the user decides (Rerun or delete) first.
    private static readonly ItemStatus[] Waiting = [ItemStatus.Open, ItemStatus.InProgress, ItemStatus.Blocked];

    // Checked as on the task form, except a waiting task of its type on the PBI: a tick reports that one.
    public async Task<Outcome<TaskSchedule>> SaveAsync(ScheduleInput input, CancellationToken cancellation)
    {
        var task = TaskOf(input);

        if (!task.Ok)
            return Outcome<TaskSchedule>.Failure(task.Problem);

        var problem = await creation.ProblemAsync(task.Value, cancellation);

        if (problem is not null)
            return Outcome<TaskSchedule>.Failure(problem);

        var row = input.Id is null ? db.TaskSchedules.Add(new TaskSchedule()).Entity : await db.TaskSchedules.SingleOrDefaultAsync(schedule => schedule.Id == input.Id, cancellation);

        if (row is null)
            return Outcome<TaskSchedule>.Failure(Problem.NotFound($"Schedule {input.Id} doesn't exist any more."));

        row.Name = task.Value.Title.Trim();
        row.AgentId = AgentStages.AnyAgentId;
        row.TaskType = task.Value.Type;
        row.Vault = input.Vault;
        row.Cron = input.Cron.Trim();
        row.Enabled = input.Enabled;
        row.Params = TaskParams.From(task.Value).ToJson();
        row.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellation);

        return Outcome<TaskSchedule>.Success(row);
    }

    private static Outcome<NewTask> TaskOf(ScheduleInput input)
    {
        var pbiProblem = OptionalPbi.Parse(input.Pbi, out var pbiId);

        if (pbiProblem is not null)
            return Outcome<NewTask>.Failure(pbiProblem);

        return Outcome<NewTask>.Success(new NewTask(input.Vault, input.TaskType.Trim(), input.Name, input.Description ?? "", input.AcceptanceCriteria ?? "", pbiId, input.Repos ?? []));
    }

    public Task DeleteAsync(int id, CancellationToken cancellation) => db.TaskSchedules.Where(schedule => schedule.Id == id).ExecuteDeleteAsync(cancellation);

    // One tick: the schedule's task unless one of its tasks still waits (user decision 2026-10-03). Returns what
    // happened, also kept on the schedule for the Tasks page.
    public async Task<string> TickAsync(TaskSchedule schedule, CancellationToken cancellation)
    {
        var result = await TickResultAsync(schedule, cancellation);

        schedule.LastRunAt = DateTime.UtcNow;
        schedule.LastResult = result;

        await db.SaveChangesAsync(cancellation);

        return result;
    }

    private async Task<string> TickResultAsync(TaskSchedule schedule, CancellationToken cancellation)
    {
        if (!await db.VaultExistsAsync(schedule.Vault, cancellation))
            return $"no task: {schedule.Vault} isn't an active vault.";
        var waiting = await WaitingTaskIdAsync(schedule.Id, cancellation);

        if (waiting is not null)
            return $"{waiting} still waits; no new task";

        return await CreateTaskAsync(schedule, cancellation);
    }

    // A refused task (e.g. a refinement still open on the PBI) is the tick's result.
    private async Task<string> CreateTaskAsync(TaskSchedule schedule, CancellationToken cancellation)
    {
        var created = await creation.CreateAsync(TaskParams.Of(schedule.Params).ToTask(schedule), cancellation);

        if (created.Ok)
            await PbiChanges.PublishAsync(db, bus, created.Value.PbiId, "task-schedule", cancellation);

        return created.Ok ? $"{created.Value.Id} created" : $"no task: {created.Problem.Detail}";
    }

    private Task<string?> WaitingTaskIdAsync(int scheduleId, CancellationToken cancellation)
    {
        return db.LocalItems.FromSql($"select * from local_item where (data->>'scheduleId')::int = {scheduleId}").Where(item => Waiting.Contains(item.Status)).Select(item => item.Id).FirstOrDefaultAsync(cancellation);
    }
}
