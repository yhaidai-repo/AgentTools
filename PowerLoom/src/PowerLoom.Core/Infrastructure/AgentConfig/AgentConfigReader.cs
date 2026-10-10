using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using PowerLoom.Infrastructure.AgentConfig.Models;
using PowerLoom.Persistence;

namespace PowerLoom.Infrastructure.AgentConfig;

// Reads the AgentConfig module's own schema (`agent_config.agent`, one JSON definition per agent): the module owns the
// rows, the host only reads what it needs.
public sealed class AgentConfigReader(PowerLoomDbContext db)
{
    private const string UndefinedTable = "42P01";

    // Null for an unknown agent, and until the module has created its schema (the agent-runner does at its start).
    public async Task<AgentSummary?> ReadAsync(string agentId, CancellationToken cancellation)
    {
        try
        {
            var definition = await db.Database.SqlQuery<string>($"select definition::text as \"Value\" from agent_config.agent where id = {agentId}").SingleOrDefaultAsync(cancellation);

            return definition is null ? null : Parse(definition);
        }
        catch (PostgresException error) when (error.SqlState == UndefinedTable)
        {
            return null;
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
            root.TryGetProperty("enabled", out var enabled) && enabled.ValueKind == JsonValueKind.True,
            Text(root, "next"),
            options);
    }

    private static string? Text(JsonElement element, string name) => element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;
}
