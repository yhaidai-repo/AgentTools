namespace PowerLoom.Features.Continue.Models;

// A kind's own section of the chat note (a PBI's Plan, a review's Comments), as Markdown.
public sealed record ChatSection(string Heading, string Markdown);
