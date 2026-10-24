namespace PowerLoom.Features.DeadLetters.Models;

// A message Wolverine gave up on: the Agents page lists these as the errors outside a single run, never hidden.
public sealed record DeadLetterInfo(Guid Id, string MessageType, string? ExceptionType, string? ExceptionMessage, DateTimeOffset SentAt, string? Source, bool Replayable);
