using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Features.Tasks.Schedules.Models;
using PowerLoom.Infrastructure.Http;
using PowerLoom.Infrastructure.Scheduling;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Vaults;
using Wolverine.Http;

namespace PowerLoom.Features.Tasks.Schedules;

// The Tasks page's schedules and the Maintenance tab's vault review: saved here, ticked by the ScheduleTicker (the
// cron rows are the only schedule); "Create now" ticks inline so the page shows the task at once.
public static class SchedulesEndpoints
{
    [WolverinePut("/api/task-schedules")]
    public static async Task<Results<Ok<SavedSchedule>, ProblemHttpResult>> Save(ScheduleInput input, TaskScheduling scheduling, PowerLoomDbContext db, CancellationToken cancellation)
    {
        if (!await db.VaultExistsAsync(input.Vault, cancellation))
            return Problem.NotFound($"{input.Vault} isn't a vault.").ToProblemResult();

        if (!CronDue.IsValid(input.Cron.Trim()))
            return Problem.Invalid($"\"{input.Cron}\" isn't a cron expression (five fields, e.g. 0 */6 * * *).").ToProblemResult();

        var saved = await scheduling.SaveAsync(input, cancellation);

        return saved.Ok ? TypedResults.Ok(Summary(saved.Value!)) : saved.Problem!.ToProblemResult();
    }

    [WolverineDelete("/api/task-schedules/{id}")]
    public static async Task<Ok> Delete(int id, [FromServices] TaskScheduling scheduling, CancellationToken cancellation)
    {
        await scheduling.DeleteAsync(id, cancellation);

        return TypedResults.Ok();
    }

    // A regular task right away (user decision 2026-10-03), even when a scheduled tick would find nothing to do.
    [WolverinePost("/api/task-schedules/{id}/tick")]
    // No body: the services are marked, or Wolverine would read the first of them from the request.
    public static async Task<Results<Ok<TickResult>, ProblemHttpResult>> Tick(int id, [FromServices] TaskScheduling scheduling, [FromServices] PowerLoomDbContext db, CancellationToken cancellation)
    {
        var schedule = await db.TaskSchedules.SingleOrDefaultAsync(row => row.Id == id, cancellation);

        if (schedule is null)
            return Problem.NotFound($"Schedule {id} doesn't exist any more.").ToProblemResult();

        return TypedResults.Ok(new TickResult(await scheduling.TickAsync(schedule, force: true, cancellation)));
    }

    private static SavedSchedule Summary(TaskSchedule row) => new(row.Id, row.Name, row.AgentId, row.Vault, row.Cron, row.Enabled);
}
