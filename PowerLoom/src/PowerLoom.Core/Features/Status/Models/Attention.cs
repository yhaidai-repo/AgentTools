namespace PowerLoom.Features.Status.Models;

// One thing the dashboard asks the user to look at; `Component` is the scheme node it highlights.
public sealed record Attention(string Component, StateLevel Severity, string Message);
