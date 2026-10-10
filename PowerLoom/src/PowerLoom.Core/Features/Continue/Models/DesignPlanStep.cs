namespace PowerLoom.Features.Continue.Models;

// One step of a design's plan (the `design.plan` JSON): what changes where, and whether the chat can do it.
public sealed record DesignPlanStep(string Step, string Repo, string[]? Locations, string Change, bool AgentDoable);
