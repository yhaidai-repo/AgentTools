using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Infrastructure.Scheduling;
using PowerLoom.Api.Tests.Probes;
using Wolverine;
using Wolverine.Tracking;

namespace PowerLoom.Api.Tests.Scheduling;

[Collection(PowerLoomCollection.Name)]
public sealed class ScheduleTickerTests(PowerLoomHost host)
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(30);

    [Fact]
    public async Task A_tick_publishes_the_lines_due_that_minute()
    {
        var ticker = host.Host.Services.GetRequiredService<ScheduleTicker>();
        var tenPast = new DateTimeOffset(2026, 1, 1, 10, 10, 0, TimeSpan.Zero);

        var session = await host.Host.Services.TrackActivity().Timeout(Timeout).ExecuteAndWaitAsync(_ => ticker.TickAsync(tenPast, CancellationToken.None));

        var probe = session.Executed.SingleMessage<VaultProbe>();

        Assert.Equal(ProbeCronSource.EveryMinute, probe.Key);
        Assert.Equal(tenPast, ticker.LastTickAt);
    }

    [Fact]
    public async Task Messages_of_one_vault_never_run_at_the_same_time()
    {
        var log = host.Host.Services.GetRequiredService<ProbeLog>();
        var probes = Enumerable.Range(1, 5).Select(number => new VaultProbe("busy-vault", $"probe-{number}")).ToList();

        var session = await host.Host.Services.TrackActivity().Timeout(Timeout).ExecuteAndWaitAsync(bus => PublishAllAsync(bus, probes));

        Assert.Equal(5, session.Executed.MessagesOf<VaultProbe>().Count());
        Assert.Equal(1, log.MaxConcurrent);
    }

    // A method, not a lambda: an async lambda fits both the Task and the ValueTask overload.
    private static async Task PublishAllAsync(IMessageContext bus, IEnumerable<VaultProbe> probes)
    {
        foreach (var probe in probes)
            await bus.PublishAsync(probe);
    }
}
