using PowerLoom.Domain.Pbis;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Api.Tests.Pbis;

public sealed class PipelineStatusDerivationTests
{
    [Fact]
    public void A_running_agent_wins_then_open_human_items_then_the_earliest_waiting_stage()
    {
        var research = Item(ItemKind.Research, "agent:research", ItemStatus.Open);
        var design = Item(ItemKind.Design, "agent:design", ItemStatus.InProgress);
        var question = Item(ItemKind.Question, "human", ItemStatus.Open);
        var finding = Item(ItemKind.Finding, "human", ItemStatus.Open);

        Assert.Equal(PipelineStatus.Designing, PipelineStatusDerivation.Derive([research, design, question]));
        Assert.Equal(PipelineStatus.WaitingHuman, PipelineStatusDerivation.Derive([research, question]));
        Assert.Equal(PipelineStatus.NeedsResearch, PipelineStatusDerivation.Derive([research, finding]));
        Assert.Equal(PipelineStatus.ReadyForDev, PipelineStatusDerivation.Derive([Item(ItemKind.Design, "agent:design", ItemStatus.Done)]));
        Assert.Null(PipelineStatusDerivation.Derive([Item(ItemKind.Docs, "agent:tech-writer", ItemStatus.Open)]));
    }

    private static LocalItem Item(ItemKind kind, string assignee, ItemStatus status) => new() { Id = Guid.NewGuid().ToString("N"), Kind = kind, Assignee = assignee, Status = status, Title = "t", Vault = "v", HeldBy = "[]" };
}
