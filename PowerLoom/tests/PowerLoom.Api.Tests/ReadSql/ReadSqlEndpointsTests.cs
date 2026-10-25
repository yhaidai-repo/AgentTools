using System.Net;
using Alba;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Api.Tests.Probes;
using PowerLoom.Features.Repos.Models;
using PowerLoom.SqlIntegration.Features.Connections.Models;
using PowerLoom.SqlIntegration.Settings;

namespace PowerLoom.Api.Tests.ReadSql;

[Collection(PowerLoomCollection.Name)]
public sealed class ReadSqlEndpointsTests(PowerLoomHost host)
{
    private const string ReadSql = $"/api/vaults/{PowerLoomHost.Vault}/read-sql";

    private const string Pos = "Server=tcp:host.docker.internal,1433;Database=Pos;User ID=reader;Password=secret-1;TrustServerCertificate=True";

    [Fact]
    public async Task An_added_connection_keeps_its_string_and_returns_only_server_and_database()
    {
        var summary = await host.Host.PostJson(new AddSqlConnectionRequest("pos-local", Pos), $"{ReadSql}/connections").Receive<SqlConnectionSummary>();

        var saved = (await ReadSettingsAsync()).Find("pos-local");

        Assert.Equal(new SqlConnectionSummary("pos-local", "tcp:host.docker.internal,1433", "Pos", true), summary);
        Assert.Equal(Pos, saved!.ConnectionString);
    }

    [Fact]
    public async Task A_taken_name_an_invalid_name_and_a_string_without_a_server_are_refused()
    {
        await host.Host.PostJson(new AddSqlConnectionRequest("taken", Pos), $"{ReadSql}/connections").Receive<SqlConnectionSummary>();

        await AddShouldFailAsync(new AddSqlConnectionRequest("TAKEN", Pos), HttpStatusCode.Conflict);
        await AddShouldFailAsync(new AddSqlConnectionRequest("has space", Pos), HttpStatusCode.BadRequest);
        await AddShouldFailAsync(new AddSqlConnectionRequest("no-server", "Database=Pos"), HttpStatusCode.BadRequest);
        await AddShouldFailAsync(new AddSqlConnectionRequest("not-a-string", "just words"), HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task The_vault_switch_and_a_connection_switch_are_saved_and_a_removed_connection_is_gone()
    {
        await host.Host.PostJson(new AddSqlConnectionRequest("switched", Pos), $"{ReadSql}/connections").Receive<SqlConnectionSummary>();
        await host.Host.Scenario(scenario => scenario.Put.Json(new EnabledRequest(true)).ToUrl(ReadSql));

        var off = await host.Host.PutJson(new EnabledRequest(false), $"{ReadSql}/connections/switched/enabled").Receive<SqlConnectionSummary>();
        var switched = await ReadSettingsAsync();

        await host.Host.Scenario(scenario => scenario.Delete.Url($"{ReadSql}/connections/switched"));

        var removed = await ReadSettingsAsync();

        Assert.False(off!.Enabled);
        Assert.True(switched.Enabled);
        Assert.False(switched.Find("switched")!.Enabled);
        Assert.Null(removed.Find("switched"));
    }

    [Fact]
    public async Task An_unknown_connection_or_vault_is_not_found()
    {
        await host.Host.Scenario(scenario =>
        {
            scenario.Put.Json(new EnabledRequest(true)).ToUrl($"{ReadSql}/connections/no-such-connection/enabled");
            scenario.StatusCodeShouldBe(HttpStatusCode.NotFound);
        });

        await host.Host.Scenario(scenario =>
        {
            scenario.Put.Json(new EnabledRequest(true)).ToUrl("/api/vaults/no-such-vault/read-sql");
            scenario.StatusCodeShouldBe(HttpStatusCode.NotFound);
        });
    }

    [Fact]
    public async Task The_test_asks_the_runner_with_the_saved_string_or_the_typed_one()
    {
        var tester = host.Host.Services.GetRequiredService<FakeSqlConnectionTester>();
        const string typed = "Server=db2;Database=Vapi";

        await host.Host.PostJson(new AddSqlConnectionRequest("tested", Pos), $"{ReadSql}/connections").Receive<SqlConnectionSummary>();

        var saved = await host.Host.PostJson(new TestSqlConnectionRequest("tested", null), $"{ReadSql}/test").Receive<SqlConnectionCheck>();
        var savedString = tester.LastConnectionString;
        var fromForm = await host.Host.PostJson(new TestSqlConnectionRequest("tested", typed), $"{ReadSql}/test").Receive<SqlConnectionCheck>();

        Assert.Equal(tester.Answer, saved);
        Assert.Equal(Pos, savedString);
        Assert.Equal(tester.Answer, fromForm);
        Assert.Equal(typed, tester.LastConnectionString);
    }

    [Fact]
    public async Task A_string_without_a_server_is_answered_without_the_runner_and_an_empty_test_is_refused()
    {
        var check = await host.Host.PostJson(new TestSqlConnectionRequest(null, "just words"), $"{ReadSql}/test").Receive<SqlConnectionCheck>();

        Assert.Equal(new SqlConnectionCheck(false, "Not a SQL Server connection string: it needs at least a Server (Data Source)."), check);

        await host.Host.Scenario(scenario =>
        {
            scenario.Post.Json(new TestSqlConnectionRequest(null, " ")).ToUrl($"{ReadSql}/test");
            scenario.StatusCodeShouldBe(HttpStatusCode.BadRequest);
        });

        await host.Host.Scenario(scenario =>
        {
            scenario.Post.Json(new TestSqlConnectionRequest("no-such-connection", null)).ToUrl($"{ReadSql}/test");
            scenario.StatusCodeShouldBe(HttpStatusCode.NotFound);
        });
    }

    private async Task AddShouldFailAsync(AddSqlConnectionRequest request, HttpStatusCode status)
    {
        await host.Host.Scenario(scenario =>
        {
            scenario.Post.Json(request).ToUrl($"{ReadSql}/connections");
            scenario.StatusCodeShouldBe(status);
        });
    }

    private async Task<ReadSqlSettings> ReadSettingsAsync()
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<ReadSqlSettingsStore>().ReadAsync(PowerLoomHost.Vault, CancellationToken.None);
    }
}
