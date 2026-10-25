using PowerLoom.Api.Tests.Probes;
using PowerLoom.Domain.Repos;

namespace PowerLoom.Api.Tests.Repos;

public sealed class GitRefsTests
{
    private readonly string checkout = FakeCheckout.Create(Path.Combine(Path.GetTempPath(), "gitrefs-" + Guid.NewGuid().ToString("N")), "app", "develop",
        new() { ["develop"] = FakeCheckout.Sha('a'), ["feature/7-login"] = FakeCheckout.Sha('b') }, new() { ["release/1"] = FakeCheckout.Sha('c'), ["develop"] = FakeCheckout.Sha('9') });

    [Fact]
    public void A_branch_head_comes_from_its_loose_ref_before_packed_refs()
    {
        Assert.Equal(FakeCheckout.Sha('a'), GitRefs.HeadOf(checkout, "develop"));
        Assert.Equal(FakeCheckout.Sha('b'), GitRefs.HeadOf(checkout, "feature/7-login"));
        Assert.Equal(FakeCheckout.Sha('c'), GitRefs.HeadOf(checkout, "release/1"));
        Assert.Null(GitRefs.HeadOf(checkout, "missing"));
    }

    [Fact]
    public void The_current_branch_is_read_from_HEAD()
    {
        Assert.Equal("develop", GitRefs.CurrentBranch(checkout));
        Assert.Null(GitRefs.CurrentBranch(Path.Combine(checkout, "nothing")));
    }

    [Theory]
    [InlineData("../../etc/passwd")]
    [InlineData("feature/../develop")]
    [InlineData("/develop")]
    [InlineData("develop.lock")]
    [InlineData("a b")]
    public void A_name_git_does_not_allow_never_reaches_the_file_system(string name)
    {
        Assert.False(GitRefs.IsBranchName(name));
        Assert.Null(GitRefs.HeadOf(checkout, name));
    }
}
