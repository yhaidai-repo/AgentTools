using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using PowerLoom.Infrastructure.AgentConfig.Models;
using PowerLoom.Persistence;

namespace PowerLoom.Infrastructure.AgentConfig;

// Reads the AgentConfig module's own schema (`agent_config.agent`, one JSON definition per agent; `agent_config.global`):
// the module owns the rows (the web saves them through it), the host only reads what it needs.
public sealed class AgentConfigReader(PowerLoomDbContext db)
{
    private const string UndefinedTable = "42P01";
    private const int DefaultTimeoutMinutes = AgentSummaryDefaults.TimeoutMinutes;
    private const int DefaultBatchSize = AgentSummaryDefaults.BatchSize;

    private static readonly AgentsGlobal DefaultGlobal = new(false, null, 10);

    // Null for an unknown agent, and until the module has created its schema (the agent-runner does at its start).
    public async Task<AgentSummary?> ReadAsync(string agentId, CancellationToken cancellation)
    {
        var definitions = await QueryAsync($"select definition::text as \"Value\" from agent_config.agent where id = {agentId}", cancellation);

        return definitions.Count == 0 ? null : Parse(definitions[0]);
    }

    public async Task<IReadOnlyList<AgentSummary>> ListAsync(CancellationToken cancellation)
    {
        var definitions = await QueryAsync($"select definition::text as \"Value\" from agent_config.agent order by id", cancellation);

        return definitions.Select(Parse).ToList();
    }

    public async Task<AgentsGlobal> GlobalAsync(CancellationToken cancellation)
    {
        var values = await QueryAsync($"select value::text as \"Value\" from agent_config.global where id = 1", cancellation);

        return values.Count == 0 ? DefaultGlobal : ParseGlobal(values[0]);
    }

    private async Task<List<string>> QueryAsync(FormattableString sql, CancellationToken cancellation)
    {
        try
        {
            return await db.Database.SqlQuery<string>(sql).ToListAsync(cancellation);
        }
        catch (PostgresException error) when (error.SqlState == UndefinedTable)
        {
            return [];
        }
    }

    private static AgentSummary Parse(string definition)
    {
        using var document = JsonDocument.Parse(definition);
        var root = document.RootElement;
        var options = root.TryGetProperty("options", out var found) ? found.Clone() : JsonDocument.Parse("{}").RootElement.Clone();

        return new AgentSummary(
            Text(root, "id") ?? "",
            Text(root, "label") ?? "",
            Flag(root, "enabled"),
            Text(root, "schedule"),
            Strings(root, "waitFor"),
            Strings(root, "handles"),
            root.TryGetProperty("capabilities", out var capabilities) && Flag(capabilities, "webAccess"),
            root.TryGetProperty("limits", out var limits) ? Number(limits, "timeoutMinutes", DefaultTimeoutMinutes) : DefaultTimeoutMinutes,
            Number(options, "batchSize", DefaultBatchSize),
            options,
            root.TryGetProperty("budgets", out var budgets) ? Money(budgets, "dailyUsd") : AgentSummaryDefaults.DailyBudgetUsd,
            root.TryGetProperty("capabilities", out var withIntegrations) ? SwitchedOn(withIntegrations, "integrations") : []);
    }

    private static AgentsGlobal ParseGlobal(string value)
    {
        using var document = JsonDocument.Parse(value);
        var root = document.RootElement;
        var pausedUntil = Text(root, "pausedUntil");

        return new AgentsGlobal(
            Flag(root, "paused"),
            pausedUntil is not null && DateTimeOffset.TryParse(pausedUntil, null, System.Globalization.DateTimeStyles.AssumeUniversal, out var until) ? until : null,
            root.TryGetProperty("dailyBudgetUsd", out var budget) && budget.ValueKind == JsonValueKind.Number ? budget.GetDecimal() : DefaultGlobal.DailyBudgetUsd);
    }

    private static string? Text(JsonElement element, string name) => element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;

    private static bool Flag(JsonElement element, string name) => element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.True;

    private static decimal Money(JsonElement element, string name) => element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.Number ? value.GetDecimal() : AgentSummaryDefaults.DailyBudgetUsd;

    private static int Number(JsonElement element, string name, int fallback) => element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.Number ? value.GetInt32() : fallback;

    private static IReadOnlyList<string> SwitchedOn(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var value) || value.ValueKind != JsonValueKind.Object)
            return [];

        return value.EnumerateObject().Where(entry => entry.Value.ValueKind == JsonValueKind.True).Select(entry => entry.Name).ToList();
    }

    private static IReadOnlyList<string> Strings(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var value) || value.ValueKind != JsonValueKind.Array)
            return [];

        return value.EnumerateArray().Where(item => item.ValueKind == JsonValueKind.String).Select(item => item.GetString()!).ToList();
    }
}
