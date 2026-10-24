using Alba;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Api.Tests.Probes;
using PowerLoom.Features.Status;
using PowerLoom.Features.Status.Models;
using PowerLoom.Infrastructure.Runner.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;
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

    [Fact]
    public async Task An_open_access_request_and_a_failing_resource_need_attention_and_a_good_read_is_ok()
    {
        await SeedOutsideAccessAsync();

        var status = await host.Host.GetAsJson<SystemStatus>("/api/status");
        var states = status!.Outside.ToDictionary(state => state.Component);

        Assert.Equal((StateLevel.Ok, "tool-sql"), (states["sql-server"].State, states["sql-server"].Tool));
        Assert.Equal((StateLevel.Degraded, "tool-azure"), (states["azure"].State, states["azure"].Tool));
        Assert.Equal((StateLevel.Degraded, "tool-mongo"), (states["mongo"].State, states["mongo"].Tool));
        Assert.False(states.ContainsKey("devhub"));
        Assert.Contains(status.Attention, item => item.Component == "azure" && item.Message.StartsWith("HT-STATUS-1 is open"));
        Assert.Contains(status.Attention, item => item.Component == "mongo" && item.Message.Contains("The last 3 agent calls to 10.0.0.9:27017 failed: connection timed out"));
        Assert.DoesNotContain(status.Attention, item => item.Message.StartsWith("The last") && item.Message.Contains("status-bus.servicebus.windows.net"));
    }

    // An open access request for a Service Bus namespace (which also failed three times: the request covers it), three
    // failed reads of a Mongo server, a good SQL read, and a DevHub call a guard refused.
    private async Task SeedOutsideAccessAsync()
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        var now = DateTime.UtcNow;
        var request = new LocalItem { Id = "HT-STATUS-1", Kind = ItemKinds.Human, Vault = PowerLoomHost.Vault, Title = "Access to status-bus.servicebus.windows.net for research", Status = ItemStatus.Open, Assignee = "human", HeldBy = "[]", Data = AccessRequestData };

        db.LocalItems.Add(request);
        db.DataAccesses.AddRange(Enumerable.Range(1, 3).Select(minutes => Call("serviceBus", "status-bus.servicebus.windows.net", "denied", "Unauthorized", now.AddMinutes(-minutes))));
        db.DataAccesses.AddRange(Enumerable.Range(1, 3).Select(minutes => Call("mongo", "10.0.0.9:27017", "failed", "connection timed out", now.AddMinutes(-minutes))));
        db.DataAccesses.Add(Call("sql", "status-sql", "ok", null, now.AddMinutes(-5)));
        db.DataAccesses.Add(Call("localStack", "status-devhub", "refused", "not the run's own stack", now.AddMinutes(-5)));
        await db.SaveChangesAsync();
    }

    private const string AccessRequestData = "{\"accessRequest\":{\"kind\":\"serviceBus\",\"resource\":\"status-bus.servicebus.windows.net\",\"agentTaskId\":null}}";

    private static DataAccess Call(string kind, string resource, string outcome, string? reason, DateTime startedAt)
    {
        return new DataAccess { Vault = PowerLoomHost.Vault, AgentId = "research", RunId = 1, Tool = $"{kind}_tool", Kind = kind, Resource = resource, Target = resource, Request = "probe", Outcome = outcome, Reason = reason, StartedAt = startedAt };
    }

    private async Task<Guid> StoreDeadLetterAsync()
    {
        var store = host.Host.Services.GetRequiredService<IMessageStore>();
        var envelope = new Envelope(new VaultProbe(PowerLoomHost.Vault, "status")) { Id = Guid.NewGuid(), MessageType = "vault-probe", Data = [], Destination = new Uri("local://vault") };

        await store.Inbox.MoveToDeadLetterStorageAsync(envelope, new InvalidOperationException("boom: status"));

        return envelope.Id;
    }
}
