using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Domain.Tasks;
using PowerLoom.Domain.Tasks.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;

namespace PowerLoom.Api.Tests.Tasks;

// Gated dependencies (hand-off v1, user decision 2026-10-28): a task that depends on a gated hand-off's target starts
// only as the gate allows; a refusal blocks it with a reason. The handoff row follows its target's status (trigger).
[Collection(PowerLoomCollection.Name)]
public sealed class HandoffGatesTests(PowerLoomHost host)
{
    private const string Approved = "### 1. Review \"the plan\" and decide\n\napprove\n\n### 2. Check the facts and assumptions it rests on\n\nok";
    private const string Changes = "### 1. Review \"the plan\" and decide\n\nchanges: archive after 30 days, not 7\n\n### 2. Check the facts and assumptions it rests on\n\nok";

    [Fact]
    public async Task An_approved_review_releases_the_implementation_and_closes_its_hand_off()
    {
        var ids = await SeedReviewChainAsync(63101, "approve");

        var waiting = await ReasonsOfAsync(ids.Task);

        await CloseAsync(ids.Review, ItemStatus.Done, Approved);

        Assert.Equal([$"Waiting for {ids.Review}"], waiting);
        Assert.Empty(await ReasonsOfAsync(ids.Task));
        Assert.Empty(await RefusalsOfAsync(ids.Task));
        Assert.Equal("closed", await HandoffStatusAsync(ids.Review));
    }

    [Fact]
    public async Task A_review_that_asks_for_changes_or_is_cancelled_refuses_the_implementation()
    {
        var changed = await SeedReviewChainAsync(63102, "approve");
        var cancelled = await SeedReviewChainAsync(63103, "approve");

        await CloseAsync(changed.Review, ItemStatus.Done, Changes);
        await CloseAsync(cancelled.Review, ItemStatus.Cancelled, null);

        Assert.Equal([$"{changed.Review} asked for changes: changes: archive after 30 days, not 7"], await RefusalsOfAsync(changed.Task));
        Assert.Equal([$"{cancelled.Review} was cancelled: the review never approved it"], await RefusalsOfAsync(cancelled.Task));
    }

    [Fact]
    public async Task A_task_that_reads_its_review_starts_on_changes_but_not_on_a_cancelled_review()
    {
        var changed = await SeedReviewChainAsync(63107, "approve", readsReview: true);
        var cancelled = await SeedReviewChainAsync(63108, "approve", readsReview: true);

        await CloseAsync(changed.Review, ItemStatus.Done, Changes);
        await CloseAsync(cancelled.Review, ItemStatus.Cancelled, null);

        Assert.Empty(await RefusalsOfAsync(changed.Task));
        Assert.Equal([$"{cancelled.Review} was cancelled: the review never approved it"], await RefusalsOfAsync(cancelled.Task));
    }

    [Fact]
    public void A_review_closed_without_a_decision_is_refused_even_for_a_task_that_reads_it()
    {
        var refusal = HandoffGates.RefusalOf(new GatedDependency("HT-1", "approve", "done", "### 2. Check\n\nok"), readsReview: true);

        Assert.Equal("HT-1 closed without a review decision", refusal);
    }

    [Fact]
    public async Task A_refused_task_is_blocked_with_the_gate_s_reason()
    {
        var ids = await SeedReviewChainAsync(63104, "approve");

        await CloseAsync(ids.Review, ItemStatus.Done, Changes);
        await BlockAsync(ids.Task, await RefusalsOfAsync(ids.Task));

        var task = await ItemAsync(ids.Task);

        Assert.Equal(ItemStatus.Blocked, task.Status);
        Assert.Contains("asked for changes", task.HeldBy);
    }

    [Fact]
    public async Task An_answer_gate_refuses_a_dismissed_question_and_no_gate_releases_on_any_close()
    {
        var answer = await SeedReviewChainAsync(63105, "answer");
        var none = await SeedReviewChainAsync(63106, "none");

        await CloseAsync(answer.Review, ItemStatus.Dismissed, null);
        await CloseAsync(none.Review, ItemStatus.Cancelled, null);

        Assert.Equal([$"{answer.Review} was dismissed without an answer"], await RefusalsOfAsync(answer.Task));
        Assert.Empty(await RefusalsOfAsync(none.Task));
        Assert.Empty(await ReasonsOfAsync(none.Task));
    }

    [Theory]
    [InlineData(Approved, "approve")]
    [InlineData("### 1. Decide\n\nApproved.", "Approved.")]
    [InlineData("### 2. Check the facts and assumptions it rests on\n\nok", "")]
    [InlineData(null, "")]
    public void The_decision_is_the_first_step_s_answer(string? resolution, string expected)
    {
        Assert.Equal(expected, HandoffGates.FirstAnswerOf(resolution));
    }

    [Fact]
    public void Approved_with_a_full_stop_still_approves()
    {
        Assert.Null(HandoffGates.RefusalOf(new GatedDependency("HT-1", "approve", "done", "### 1. Decide\n\nApproved.")));
    }

    [Theory]
    [InlineData("`approve`", true)]
    [InlineData("\"approve\"", true)]
    [InlineData("```\napprove\n```", true)]
    [InlineData("**Approve**", true)]
    [InlineData("approve, but rename the job", false)]
    [InlineData("changes: `approve` only step 1", false)]
    public void Approve_counts_in_backticks_quotes_or_a_code_block_but_not_with_conditions(string decision, bool isApproval)
    {
        Assert.Equal(isApproval, HandoffGates.IsApproval(decision));
    }

    // A planning task, its review human task with the gate, and the implementation task that depends on the review.
    private async Task<(string Review, string Task)> SeedReviewChainAsync(int adoId, string gate, bool readsReview = false)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        var (planning, review, task) = ($"PT-{adoId}-001", $"HT-{adoId}-001", $"XT-{adoId}-001");
        var reads = readsReview ? ""","readsReview":true""" : "";

        db.WorkItems.Add(new WorkItem { AdoId = adoId, Vault = PowerLoomHost.Vault, Type = "Product Backlog Item", Title = "Gated PBI", AdoState = "New", Rev = 1, ContentHash = "h", Skills = "[]", ConfluencePages = "[]", PipelineStatus = PipelineStatus.ReadyForDesign, SyncedAt = DateTime.UtcNow });
        db.LocalItems.Add(new LocalItem { Id = planning, Kind = "planning", PbiId = adoId, Vault = PowerLoomHost.Vault, Title = "Plan", Status = ItemStatus.Done, Assignee = "agent:planning", HeldBy = "[]" });
        db.LocalItems.Add(new LocalItem { Id = review, Kind = ItemKinds.Human, PbiId = adoId, Vault = PowerLoomHost.Vault, Title = "Review the plan", Status = ItemStatus.Open, Assignee = HumanTasks.Assignee, HeldBy = "[]" });
        db.LocalItems.Add(new LocalItem { Id = task, Kind = "implement", PbiId = adoId, Vault = PowerLoomHost.Vault, Title = "Implement", Status = ItemStatus.Open, Assignee = "agent:implement", Data = $$$"""{"dependsOn":["{{{review}}}"]{{{reads}}}}""", HeldBy = "[]" });
        await db.SaveChangesAsync();
        await db.Database.ExecuteSqlAsync($"insert into handoff (from_task_id, from_agent, to_kind, to_item_id, intent, gate, body) values ({planning}, 'planning', 'human', {review}, 'review', {gate}, 'Review the plan.')");

        return (review, task);
    }

    private async Task CloseAsync(string id, ItemStatus status, string? resolution)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        var item = await db.LocalItems.SingleAsync(row => row.Id == id);

        item.Resolution = resolution;
        await ItemStatusChange.SetAsync(db, item, status, "human", null, CancellationToken.None);
    }

    private async Task<List<string>> ReasonsOfAsync(string taskId)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        var task = await db.LocalItems.AsNoTracking().SingleAsync(item => item.Id == taskId);

        return await TaskValidation.ValidateAsync(db, task, "implement", [], true, CancellationToken.None);
    }

    private async Task<List<string>> RefusalsOfAsync(string taskId)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        var task = await db.LocalItems.AsNoTracking().SingleAsync(item => item.Id == taskId);

        return await HandoffGates.RefusalsAsync(db, task, CancellationToken.None);
    }

    private async Task BlockAsync(string taskId, List<string> reasons)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        await TaskClaims.BlockAsync(db, taskId, reasons, "dispatch", CancellationToken.None);
    }

    private async Task<LocalItem> ItemAsync(string id)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        return await db.LocalItems.AsNoTracking().SingleAsync(item => item.Id == id);
    }

    private async Task<string> HandoffStatusAsync(string targetId)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        return await db.Database.SqlQuery<string>($"select status as \"Value\" from handoff where to_item_id = {targetId}").SingleAsync();
    }
}
