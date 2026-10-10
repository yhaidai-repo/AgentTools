using System.Text.Json;

namespace PowerLoom.AdoIntegration.Client.Models;

// A work item as the batch API returns it: the fields keyed by their reference names (AdoFields).
public sealed record AdoWorkItem(int Id, int Rev, Dictionary<string, JsonElement> Fields);
