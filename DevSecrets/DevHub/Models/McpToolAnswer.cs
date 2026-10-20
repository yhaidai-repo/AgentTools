namespace DevSecrets.DevHub.Models;

// What one tools/call to the Playwright MCP answered: its text parts joined, and whether it reported an error.
public sealed record McpToolAnswer(string Text, bool IsError);
