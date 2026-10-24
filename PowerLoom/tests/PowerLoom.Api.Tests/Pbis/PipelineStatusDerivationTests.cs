using PowerLoom.Domain.Pbis;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;

namespace PowerLoom.Api.Tests.Pbis;

public sealed class PipelineStatusDerivationTests
{
    [Fact]
    public void A_running_agent_wins_then_open_human_items_then_the_earliest_waiting_stage()
    {
        var research = Item(ItemKinds.Research, "agent:research", ItemStatus.Open);
        var design = Item(ItemKinds.Design, "agent:design", ItemStatus.InProgress);
        var question = Item(ItemKinds.Question, "human", ItemStatus.Open);
        var finding = Item(ItemKinds.Finding, "human", ItemStatus.Open);

        Assert.Equal(PipelineStatus.Designing, PipelineStatusDerivation.Derive([research, design, question]));
        Assert.Equal(PipelineStatus.WaitingHuman, PipelineStatusDerivation.Derive([research, question]));
        Assert.Equal(PipelineStatus.NeedsResearch, PipelineStatusDerivation.Derive([research, finding]));
        Assert.Equal(PipelineStatus.ReadyForDev, PipelineStatusDerivation.Derive([Item(ItemKinds.Design, "agent:design", ItemStatus.Done)]));
        Assert.Null(PipelineStatusDerivation.Derive([Item(ItemKinds.Docs, "agent:tech-writer", ItemStatus.Open)]));
    }

    [Fact]
    public void A_refined_pbi_is_ready_for_dev_once_no_blocker_is_left()
    {
        var refined = Item(ItemKinds.Refinement, "agent:refinement", ItemStatus.Done);
        var openQuestion = Item(ItemKinds.Question, "human", ItemStatus.Open);
        var optionalQuestion = Item(ItemKinds.Question, "human", ItemStatus.Open, """{"blocking":false}""");
        var optionalResearch = Item(ItemKinds.Research, "agent:research", ItemStatus.InProgress, """{"blocking":false}""");
        var stuckResearch = Item(ItemKinds.Research, "agent:research", ItemStatus.Blocked);

        Assert.Equal(PipelineStatus.ReadyForDev, PipelineStatusDerivation.Derive([refined]));
        Assert.Equal(PipelineStatus.ReadyForDev, PipelineStatusDerivation.Derive([refined, optionalQuestion, optionalResearch]));
        Assert.Equal(PipelineStatus.WaitingHuman, PipelineStatusDerivation.Derive([refined, openQuestion]));
        Assert.Null(PipelineStatusDerivation.Derive([refined, stuckResearch]));
        Assert.Equal(PipelineStatus.ReadyForRefinement, PipelineStatusDerivation.Derive([Item(ItemKinds.Refinement, "agent:refinement", ItemStatus.Open)]));
    }

    // The test stage (user decision 2026-10-21): a test task moves a PBI in development; its report decides the outcome.
    [Fact]
    public void A_test_task_shows_as_testing_then_its_report_decides_tested_or_test_failed()
    {
        var open = Item(ItemKinds.Test, "agent:*", ItemStatus.Open);
        var running = Item(ItemKinds.Test, "agent:*", ItemStatus.InProgress);
        var done = Item(ItemKinds.Test, "agent:*", ItemStatus.Done);
        var passed = Report(done, """{"report":{"results":[{"case":"AC 1","verdict":"pass"},{"case":"AC 2","verdict":"blocked"}]}}""");
        var failed = Report(done, """{"report":{"results":[{"case":"AC 1","verdict":"fail","bug":"PBI-40001"}]}}""");
        var design = Item(ItemKinds.Design, "agent:design", ItemStatus.Done);

        Assert.Equal(PipelineStatus.ReadyForTest, PipelineStatusDerivation.DeriveTestStage([open]));
        Assert.Equal(PipelineStatus.Testing, PipelineStatusDerivation.DeriveTestStage([open, running]));
        Assert.Equal(PipelineStatus.Tested, PipelineStatusDerivation.DeriveTestStage([done, passed]));
        Assert.Equal(PipelineStatus.TestFailed, PipelineStatusDerivation.DeriveTestStage([done, failed]));
        Assert.Null(PipelineStatusDerivation.DeriveTestStage([design]));
        Assert.Equal(PipelineStatus.Testing, PipelineStatusDerivation.Derive([design, running]));
        Assert.Equal(PipelineStatus.Tested, PipelineStatusDerivation.Derive([design, done, passed]));
    }

    private static LocalItem Report(LocalItem test, string data) => new() { Id = test.Id + "-report", Kind = ItemKinds.TestReport, ParentId = test.Id, Assignee = "agent:autotest", Status = ItemStatus.Final, Title = "r", Vault = "v", HeldBy = "[]", Data = data };

    private static LocalItem Item(string kind, string assignee, ItemStatus status, string? data = null) => new() { Id = Guid.NewGuid().ToString("N"), Kind = kind, Assignee = assignee, Status = status, Title = "t", Vault = "v", HeldBy = "[]", Data = data };
}
