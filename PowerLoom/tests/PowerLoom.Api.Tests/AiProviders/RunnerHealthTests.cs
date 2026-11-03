using PowerLoom.Infrastructure.Runner;

namespace PowerLoom.Api.Tests.AiProviders;

// The runner's /health with slots lists every running task; an older runner's `running` alone is one task of one slot
// the backend knows nothing about (no cap).
public sealed class RunnerHealthTests
{
    [Fact]
    public void A_runner_with_slots_reports_every_running_task_and_its_free_slots()
    {
        var health = RunnerClient.HealthOf("""{"ok":true,"running":"AT-1","runningTasks":["AT-1","AT-2"],"maxParallelRuns":3,"maintenanceOwner":null}""");

        Assert.Equal((true, "AT-1", 3, 1), (health.Reachable, health.RunningTask, health.MaxParallelRuns, health.FreeSlots));
        Assert.Equal(["AT-1", "AT-2"], health.RunningTasks);
    }

    [Fact]
    public void An_older_runner_without_slots_reports_its_one_task_and_no_cap()
    {
        var busy = RunnerClient.HealthOf("""{"ok":true,"running":"AT-1"}""");
        var idle = RunnerClient.HealthOf("""{"ok":true,"running":null}""");

        Assert.Equal(["AT-1"], busy.RunningTasks);
        Assert.Equal(("AT-1", (int?)null, (int?)null), (busy.RunningTask, busy.MaxParallelRuns, busy.FreeSlots));
        Assert.Empty(idle.RunningTasks);
        Assert.Null(idle.RunningTask);
        Assert.Null(idle.FreeSlots);
    }
}
