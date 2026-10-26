namespace PowerLoom.Features.Agents.PromptVersions.Models;

// One saved version of an agent's prompt (or the shared framework's): its number and its text.
public sealed record AddPromptVersionRequest(int Version, string Text);
