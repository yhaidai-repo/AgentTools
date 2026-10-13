namespace DevSecrets.DevHub.Models;

// Owner: who started the stack (PowerLoom passes its run); only the owner's DELETE stops it.
public sealed record StartStackRequest(string[] Services, string? Branch, int? TtlMinutes, string? Owner);
