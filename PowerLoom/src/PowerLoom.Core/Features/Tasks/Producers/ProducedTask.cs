namespace PowerLoom.Features.Tasks.Producers;

// The task a producer builds for one schedule tick; the schedule adds its id, key, kind and assignee. `NotNeeded`: why
// a scheduled tick creates no task (e.g. nothing to review); null = needed. "Create now" creates it anyway.
public sealed record ProducedTask(string Title, string Body, IReadOnlyDictionary<string, object?> Data, string? NotNeeded);
