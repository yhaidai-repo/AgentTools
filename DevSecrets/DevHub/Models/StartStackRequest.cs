using System.Text.Json;

namespace DevSecrets.DevHub.Models;

// Owner: who started the stack (PowerLoom passes its run); only the owner's DELETE stops it. Environment: the values file
// (values.<environment>.json) for everything that doesn't run locally; none = dev. Config: per service, what
// Start-LocalStack.ps1 -Config takes (a "configurable" service of services.json; e.g. the background host's workers).
public sealed record StartStackRequest(string[] Services, string? Branch, int? TtlMinutes, string? Owner, string? Environment = null, Dictionary<string, JsonElement>? Config = null, bool StrictBranch = false);
