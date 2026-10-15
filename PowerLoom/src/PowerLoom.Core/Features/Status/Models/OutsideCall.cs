namespace PowerLoom.Features.Status.Models;

// One outside read from the data access log, as much as the dashboard needs: where, how it ended, when.
public sealed record OutsideCall(string Kind, string Resource, string Outcome, string? Reason, DateTime StartedAt);
