namespace PowerLoom.Features.AiProviders.Models;

// `none`, `pending` while the user hasn't finished at the link, `done`, or `failed` with the reason.
public sealed record CodexLoginStatus(string Status, string? Error, string Output);
