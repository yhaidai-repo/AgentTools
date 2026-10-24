namespace PowerLoom.Features.Meetings.Models;

// One run over the vault's meetings inbox (the import cron, or Import now).
public sealed record ImportMeetings(string Vault);
