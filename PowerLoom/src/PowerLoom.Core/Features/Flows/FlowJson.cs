using System.Text.Json;
using System.Text.Json.Serialization;
using PowerLoom.Features.Flows.Models;

namespace PowerLoom.Features.Flows;

// The definition in the `flow.definition` and `flow_execution.definition` columns: camelCase, nulls left out, so the
// TypeScript side parses the row with its own FlowDefinition schema.
public static class FlowJson
{
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web) { DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull };

    public static string Serialize(FlowDefinitionInput definition) => JsonSerializer.Serialize(definition, Options);

    public static FlowDefinitionInput Parse(string json) => JsonSerializer.Deserialize<FlowDefinitionInput>(json, Options) ?? new FlowDefinitionInput([], []);
}
