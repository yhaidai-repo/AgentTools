namespace PowerLoom.AdoIntegration.Client.Models;

// What every call needs: the organization, the project, the team, and the personal access token (read scopes only).
public sealed record AdoConnection(string OrgUrl, string Project, string Team, string Pat);
