namespace PowerLoom.Features.Meetings.Models;

// What one meetings file became: the task's id, or why nothing new was made.
public sealed record MeetingImportOutcome(string? TaskId, string Message);
