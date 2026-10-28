namespace PowerLoom.Infrastructure.ChatLaunch.Models;

// A desktop conversation, never an MCP transport session or an agent run.
public sealed record ChatDestination(string Launcher, string ConversationId);
