namespace PowerLoom.AdoIntegration.Features.Connection.Models;

// What the form holds; an empty token means the saved one. Nothing is saved.
public sealed record TestConnectionRequest(string OrgUrl, string Project, string Team, string? Pat);
