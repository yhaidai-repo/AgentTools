namespace DevSecrets.DevHub.Models;

// Owner: who started the stack (PowerLoom passes its run); only the owner's DELETE stops it. Environment: the values file
// (values.<environment>.json) for everything that doesn't run locally; none = dev.
public sealed record StartStackRequest(string[] Services, string? Branch, int? TtlMinutes, string? Owner, string? Environment = null);
