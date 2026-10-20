namespace PowerLoom.AdoIntegration.Features.AddReview.Models;

// The review Add review made: the pull request found for the branch (`pull-request`) or a branch review (`branch`).
public sealed record AddedReview(int PrId, string Kind, string Message);
