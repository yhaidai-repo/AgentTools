using System.Text.Json;

namespace PowerLoom.AdoIntegration.Client.Models;

// A work item as the batch API returns it: the fields keyed by their reference names (AdoFields), and its links when
// every field was asked for (AdoFields.Every).
public sealed record AdoWorkItem(int Id, int Rev, Dictionary<string, JsonElement> Fields, List<AdoWorkItemRelation>? Relations = null);
