namespace PowerLoom.AudioCapture.Models;

// control/start.json: the CLI's `record start`; Title null = take the Teams window's title.
public sealed record StartRequest(string? Title);
