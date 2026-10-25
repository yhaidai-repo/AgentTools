namespace PowerLoom.Features.Reviews.AddLocal.Models;

// The branch a local review reviews and the base it is diffed against, with their heads in the checkout.
public sealed record LocalBranches(string Branch, string BranchHead, string Base, string BaseHead);
