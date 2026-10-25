namespace PowerLoom.Features.Agents.Dispatch.Models;

// Run now's answer: how many open tasks of its types the agent checks, and what that means in words.
public sealed record DispatchedAgent(string AgentId, int OpenTasks, string Message);
