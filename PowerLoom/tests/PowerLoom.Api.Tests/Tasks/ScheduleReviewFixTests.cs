using Alba;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Api.Tests.Persistence;
using PowerLoom.Contracts;
using PowerLoom.Features.Tasks.Schedules;
using PowerLoom.Features.Tasks.Schedules.Models;
using PowerLoom.Features.Vaults.Add.Models;
using PowerLoom.Infrastructure.Scheduling;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Enums;
using Wolverine;
using Wolverine.Tracking;

namespace PowerLoom.Api.Tests.Tasks;

[Collection(PowerLoomCollection.Name)]
public sealed class ScheduleReviewFixTests(PowerLoomHost host)
{
    [Fact]
    public async Task S3_06_Removing_a_vault_disables_its_schedule_and_refuses_stale_ticks_until_deliberately_restored()
    {
        const string vault = "scheduled-removal-boundary";
        await host.Host.PostJson(new AddVaultRequest(vault), "/api/vaults").Receive<AddedVault>();
        int scheduleId;
        using (var scope = host.Host.Services.CreateScope())
            scheduleId = await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().TaskSchedules.Where(row => row.Vault == vault).Select(row => row.Id).SingleAsync();
        await host.Host.Scenario(scenario => { scenario.Delete.Url($"/api/vaults/{vault}"); scenario.StatusCodeShouldBeOk(); });
        await PublishTick(scheduleId);
        var refused = await host.Host.PostJson(new { }, $"/api/task-schedules/{scheduleId}/tick").Receive<TickResult>();
        Assert.Contains("isn't an active vault", refused!.Result);
        using (var scope = host.Host.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
            Assert.False(await db.TaskSchedules.Where(row => row.Id == scheduleId).Select(row => row.Enabled).SingleAsync());
            Assert.False(await db.LocalItems.AnyAsync(row => row.Vault == vault));
        }
        var cron = host.Host.Services.GetServices<ICronSource>().OfType<TaskScheduleCronSource>().Single();
        Assert.DoesNotContain(await cron.EntriesAsync(CancellationToken.None), entry => entry.Key == $"task-schedule:{scheduleId}");

        await host.Host.PostJson(new AddVaultRequest(vault), "/api/vaults").Receive<AddedVault>();
        await PublishTick(scheduleId); // A queued cron message must not re-enable the restored schedule.
        using (var scope = host.Host.Services.CreateScope())
            Assert.False(await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().LocalItems.AnyAsync(row => row.Vault == vault));
        var deliberate = await host.Host.PostJson(new { }, $"/api/task-schedules/{scheduleId}/tick").Receive<TickResult>();
        Assert.EndsWith(" created", deliberate!.Result);
    }

    [Theory]
    [InlineData(false, 980180)]
    [InlineData(true, 980181)]
    public async Task S3_07_Both_cron_and_create_now_recalculate_status_and_publish_a_PBI_change(bool cron, int id)
    {
        using (var scope = host.Host.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
            ReviewFixSeed.Pbi(db, id, PowerLoomHost.Vault);
            await db.SaveChangesAsync();
        }
        var input = new ScheduleInput(null, "Scheduled test", PowerLoomHost.Vault, "0 7 * * 1", true, "test", "Test the PBI", "Verify the result", id.ToString(), []);
        var saved = await host.Host.PutJson(input, "/api/task-schedules").Receive<SavedSchedule>();
        var changes = await host.Host.Services.TrackActivity().Timeout(TimeSpan.FromSeconds(30)).ExecuteAndWaitAsync((Func<IMessageContext, Task>)(async bus =>
        {
            if (cron) await bus.PublishAsync(new CreateScheduledTask(saved!.Id));
            else await host.Host.PostJson(new { }, $"/api/task-schedules/{saved!.Id}/tick").Receive<TickResult>();
        }));
        Assert.Contains(changes.Sent.MessagesOf<PbiChanged>(), message => message.AdoId == id);
        using (var scope = host.Host.Services.CreateScope())
            Assert.Equal(PipelineStatus.ReadyForTest, await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().WorkItems.Where(row => row.AdoId == id).Select(row => row.PipelineStatus).SingleAsync());
        var again = await host.Host.Services.TrackActivity().Timeout(TimeSpan.FromSeconds(30)).ExecuteAndWaitAsync((Func<IMessageContext, Task>)(async _ =>
        {
            await host.Host.PostJson(new { }, $"/api/task-schedules/{saved!.Id}/tick").Receive<TickResult>();
        }));
        Assert.DoesNotContain(again.Sent.MessagesOf<PbiChanged>(), message => message.AdoId == id);
    }

    [Fact]
    public async Task S3_07_A_refused_creation_does_not_recalculate_or_publish()
    {
        const int id = 980182;
        using (var scope = host.Host.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
            ReviewFixSeed.Pbi(db, id, PowerLoomHost.Vault);
            ReviewFixSeed.Item(db, $"RT-{id}-001", PowerLoomHost.Vault, "refinement", id);
            await db.SaveChangesAsync();
        }
        var input = new ScheduleInput(null, "Refused refinement", PowerLoomHost.Vault, "0 7 * * 1", true, "refinement", "Refine", "Complete", id.ToString(), []);
        var saved = await host.Host.PutJson(input, "/api/task-schedules").Receive<SavedSchedule>();
        TickResult? result = null;
        var changes = await host.Host.Services.TrackActivity().Timeout(TimeSpan.FromSeconds(30)).ExecuteAndWaitAsync((Func<IMessageContext, Task>)(async _ =>
        {
            result = await host.Host.PostJson(new { }, $"/api/task-schedules/{saved!.Id}/tick").Receive<TickResult>();
        }));
        Assert.StartsWith("no task:", result!.Result);
        Assert.DoesNotContain(changes.Sent.MessagesOf<PbiChanged>(), message => message.AdoId == id);
        using var finalScope = host.Host.Services.CreateScope();
        Assert.Equal(PipelineStatus.Development, await finalScope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().WorkItems.Where(row => row.AdoId == id).Select(row => row.PipelineStatus).SingleAsync());
    }

    private Task<ITrackedSession> PublishTick(int id) => host.Host.Services.TrackActivity().Timeout(TimeSpan.FromSeconds(30)).ExecuteAndWaitAsync(bus => bus.PublishAsync(new CreateScheduledTask(id)).AsTask());
}
