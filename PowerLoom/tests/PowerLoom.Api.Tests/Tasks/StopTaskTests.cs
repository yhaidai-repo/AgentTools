using System.Net;
using Alba;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Api.Tests.Probes;
using PowerLoom.Features.Tasks.StopTask.Models;

namespace PowerLoom.Api.Tests.Tasks;

// Stop on a running run (user decision 2026-10-26): the runner is asked to stop that task's run; any other task is refused.
[Collection(PowerLoomCollection.Name)]
public sealed class StopTaskTests(PowerLoomHost host)
{
    private FakeRunnerClient Runner => host.Host.Services.GetRequiredService<FakeRunnerClient>();

    [Fact]
    public async Task The_running_task_is_stopped_and_one_that_isn_t_running_is_refused()
    {
        Runner.Running = "T-STOP-1";

        var stopped = await host.Host.Scenario(scenario => scenario.Post.Url("/api/tasks/T-STOP-1/stop"));
        await host.Host.Scenario(scenario =>
        {
            scenario.Post.Url("/api/tasks/T-STOP-2/stop");
            scenario.StatusCodeShouldBe(HttpStatusCode.Conflict);
        });
        Runner.Running = null;

        Assert.Equal("T-STOP-1", (await stopped.ReadAsJsonAsync<StoppedTask>())!.TaskId);
        Assert.Equal(["T-STOP-1", "T-STOP-2"], Runner.Stops.Where(id => id.StartsWith("T-STOP-")));
    }
}
