namespace PowerLoom.Features.Status.Models;

// Wolverine's tables: messages waiting, scheduled, and given up on.
public sealed record MessagingStatus(int Incoming, int Scheduled, int DeadLetters, int DeadLettersLast24h, Dictionary<string, int> IncomingByType);
