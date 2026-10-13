namespace DevSecrets.StackBridge.Models;

public sealed record StartStackRequest(string[] Services, string? Branch, int? TtlMinutes);
