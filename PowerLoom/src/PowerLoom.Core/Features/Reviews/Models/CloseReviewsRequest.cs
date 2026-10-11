namespace PowerLoom.Features.Reviews.Models;

public sealed record CloseReviewsRequest(List<int> PrIds, string? Reason);
