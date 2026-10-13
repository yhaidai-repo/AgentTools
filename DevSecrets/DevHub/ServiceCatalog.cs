using System.Text.Json;
using System.Text.Json.Nodes;
using DevSecrets.DevHub.Config;
using DevSecrets.DevHub.Models;
using Microsoft.Extensions.Options;

namespace DevSecrets.DevHub;

// The runnable services of services.json, read on every call so edits apply without a restart; where each answers on
// this PC is its "<app>-url" in values.local.json.
public sealed class ServiceCatalog(IOptions<DevHubOptions> options, DevSecretsFiles files)
{
    public IReadOnlyList<ServiceInfo> GetServices()
    {
        using var document = JsonDocument.Parse(File.ReadAllText(Path.Combine(options.Value.ScriptsDir, "services.json")));
        var local = files.ReadValues("local") ?? [];

        return document.RootElement.EnumerateObject()
            .Where(service => service.Value.TryGetProperty("run", out _))
            .Select(service => ToServiceInfo(service, local))
            .OrderBy(service => service.Name, StringComparer.Ordinal)
            .ToList();
    }

    public string[] FindUnknown(IEnumerable<string> names)
    {
        var known = GetServices().Select(service => service.Name).ToHashSet(StringComparer.Ordinal);

        return names.Where(name => !known.Contains(name)).ToArray();
    }

    private static ServiceInfo ToServiceInfo(JsonProperty service, JsonObject local) =>
        new(
            service.Name,
            ReadString(service.Value, "note"),
            local[$"{service.Name}-url"]?.ToString(),
            service.Value.TryGetProperty("consumesBus", out var consumesBus) && consumesBus.GetBoolean()
        );

    private static string? ReadString(JsonElement element, string property) =>
        element.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;
}
