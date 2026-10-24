using System.Text.Json;

namespace PowerLoom.AdoIntegration.Client.Models;

// One link of a work item (parent, child, pull request, attached file …): `Rel` names its kind.
public sealed record AdoWorkItemRelation(string Rel, string Url, Dictionary<string, JsonElement>? Attributes);
