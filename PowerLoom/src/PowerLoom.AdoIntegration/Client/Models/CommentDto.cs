namespace PowerLoom.AdoIntegration.Client.Models;

public sealed record CommentDto(string? Text, CommentAuthorDto? CreatedBy, DateTime? CreatedDate);
