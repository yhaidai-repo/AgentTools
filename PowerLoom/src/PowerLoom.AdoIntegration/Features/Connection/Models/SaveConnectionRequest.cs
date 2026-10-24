namespace PowerLoom.AdoIntegration.Features.Connection.Models;

// An empty token keeps the saved one (user decision 2026-10-06).
public sealed record SaveConnectionRequest(bool Enabled, string OrgUrl, string Project, string Team, string User, string? Pat);
