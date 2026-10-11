using Alba;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Api.Tests.Probes;
using PowerLoom.Features.Status;
using PowerLoom.Features.Status.Models;
using PowerLoom.Infrastructure.Runner.Models;
using Wolverine;
using Wolverine.Persistence.Durability;

namespace PowerLoom.Api.Tests.Status;

[Collection(PowerLoomCollection.Name)]
public sealed class SystemStatusTests(PowerLoomHost host)
{
    [Fact]
    public async Task The_status_reports_each_component_and_what_needs_attention()
    {
        var runner = host.Host.Services.GetRequiredService<FakeRunnerClient>();
        var deadLetter = await StoreDeadLetterAsync();

        runner.Health = new RunnerHealth(false, null, "connection refused");

        var status = await host.Host.GetAsJson<SystemStatus>("/api/status");

        Assert.Equal(StateLevel.Ok, status!.Database.State);
        Assert.NotNull(status.Ticker.StartedAt);
        Assert.Equal((StateLevel.Degraded, false), (status.Runner.State, status.Runner.Reachable));
        Assert.Contains(status.Vaults, vault => vault.Name == PowerLoomHost.Vault);
        Assert.True(status.Messaging.DeadLetters >= 1);
        Assert.Contains(status.Schedules, schedule => schedule.Key == "agent:research" && schedule.Cron == "*/15 * * * *" && schedule.NextDueAt > status.CheckedAt);
        Assert.Contains(status.Attention, item => item.Component == AttentionRules.RunnerComponent && item.Message.Contains("connection refused"));
        Assert.Contains(status.Attention, item => item.Component == AttentionRules.MessagingComponent && item.Message.Contains("dead letter"));
        Assert.Contains(status.Budget.Agents, agent => agent.AgentId == "research");

        // The runner back, the dead letter gone: nothing left for those two.
        await host.Host.Scenario(scenario =>
        {
            scenario.Delete.Url($"/api/dead-letters/{deadLetter}");
            scenario.StatusCodeShouldBeOk();
        });
        runner.Health = new RunnerHealth(true, "AT-1-001", null);

        var again = await host.Host.GetAsJson<SystemStatus>("/api/status");

        Assert.Equal((StateLevel.Ok, "AT-1-001"), (again!.Runner.State, again.Runner.RunningTask));
        Assert.DoesNotContain(again.Attention, item => item.Component == AttentionRules.RunnerComponent);
    }

    private async Task<Guid> StoreDeadLetterAsync()
    {
        var store = host.Host.Services.GetRequiredService<IMessageStore>();
        var envelope = new Envelope(new VaultProbe(PowerLoomHost.Vault, "status")) { Id = Guid.NewGuid(), MessageType = "vault-probe", Data = [], Destination = new Uri("local://vault") };

        await store.Inbox.MoveToDeadLetterStorageAsync(envelope, new InvalidOperationException("boom: status"));

        return envelope.Id;
    }
}
