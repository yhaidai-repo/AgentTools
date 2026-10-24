namespace PowerLoom.Features.Status.Models;

public sealed record TickerStatus(StateLevel State, DateTimeOffset? StartedAt, DateTimeOffset? LastTickAt);
