namespace PowerLoom.Features.Reviews.Models;

// The pull requests the action applied to (with the task id for a queue, the title for a delete), and the refusals.
public sealed record ReviewsResult(List<ReviewOutcome> Done, List<string> Refused);
