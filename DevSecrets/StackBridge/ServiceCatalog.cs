using System.Text.Json;
using DevSecrets.StackBridge.Models;
using Microsoft.Extensions.Options;

namespace DevSecrets.StackBridge;

// The runnable services of services.json, read on every call so edits apply without a restart.
public sealed class ServiceCatalog(IOptions<StackBridgeOptions> options)
{
    public IReadOnlyList<ServiceInfo> GetServices()
    {
        using var document = JsonDocument.Parse(File.ReadAllText(Path.Combine(options.Value.ScriptsDir, "services.json")));

        return document.RootElement.EnumerateObject()
            .Where(service => service.Value.TryGetProperty("run", out _))
            .Select(ToServiceInfo)
            .OrderBy(service => service.Name, StringComparer.Ordinal)
            .ToList();
    }

    public string[] FindUnknown(IEnumerable<string> names)
    {
        var known = GetServices().Select(service => service.Name).ToHashSet(StringComparer.Ordinal);

        return names.Where(name => !known.Contains(name)).ToArray();
    }

    private static ServiceInfo ToServiceInfo(JsonProperty service) =>
        new(
            service.Name,
            ReadString(service.Value, "note"),
            ReadString(service.Value, "localUrl"),
            service.Value.TryGetProperty("consumesBus", out var consumesBus) && consumesBus.GetBoolean()
        );

    private static string? ReadString(JsonElement element, string property) =>
        element.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;
}
