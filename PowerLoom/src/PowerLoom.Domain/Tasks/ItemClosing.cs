using PowerLoom.Contracts;
using PowerLoom.Domain.Pbis;
using PowerLoom.Domain.Tasks.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;

namespace PowerLoom.Domain.Tasks;

// A person closing a question, finding or human task (PowerLoom's humanItems), or cancelling an agent task of any kind
// that waits (user decision 2026-10-21): checked before anything is stored, so a rejected request leaves no upload
// behind; status_history records the person as the actor.
public static class ItemClosing
{
    private const string Actor = "human";

    // A running agent task finishes its run first.
    private static readonly ItemStatus[] WaitingAgentTask = [ItemStatus.Open, ItemStatus.Blocked];

    // Which decisions each human item kind takes, and the status each one leads to. A finding is closed with an answer
    // here; "submit to vault" goes through Docs / Records.
    private static readonly Dictionary<string, Dictionary<CloseDecision, ItemStatus>> Decisions = new()
    {
        [ItemKinds.Question] = new() { [CloseDecision.Answer] = ItemStatus.Answered, [CloseDecision.Dismiss] = ItemStatus.Dismissed },
        [ItemKinds.Finding] = new() { [CloseDecision.Answer] = ItemStatus.Answered, [CloseDecision.Dismiss] = ItemStatus.Dismissed },
        [ItemKinds.Human] = new() { [CloseDecision.Done] = ItemStatus.Done, [CloseDecision.Cancel] = ItemStatus.Cancelled },
    };

    public static async Task<Outcome<LocalItem>> FindClosableAsync(PowerLoomDbContext db, CloseItemRequest request, CancellationToken cancellation)
    {
        var item = await ItemScope.FindAsync(db, request.AdoId, request.ItemId, cancellation);

        if (item is null || !IsClosableByPerson(item))
            return Outcome<LocalItem>.Failure(Problem.NotFound($"{request.ItemId} is not a question, human task, finding or agent task of {ItemScope.PbiLabel(request.AdoId)}."));

        var problem = AgentStages.IsAgentTask(item.Assignee) ? AgentTaskProblemOf(item, request) : await ProblemOfAsync(db, item, request, cancellation);

        return problem is null ? Outcome<LocalItem>.Success(item) : Outcome<LocalItem>.Failure(problem);
    }

    // Closes an item checked by FindClosableAsync; the new status.
    public static async Task<ItemStatus> CloseAsync(PowerLoomDbContext db, LocalItem item, CloseItemRequest request, CancellationToken cancellation)
    {
        var status = AgentStages.IsAgentTask(item.Assignee) ? ItemStatus.Cancelled : Decisions[item.Kind][request.Decision];

        item.Resolution = request.Resolution;

        await RepoConfirmation.ApplyAsync(db, item, request, cancellation);
        await ItemStatusChange.SetAsync(db, item, status, Actor, null, cancellation);

        return status;
    }

    private static bool IsClosableByPerson(LocalItem item) => item.Assignee == HumanTasks.Assignee || AgentStages.IsAgentTask(item.Assignee);

    private static Problem? AgentTaskProblemOf(LocalItem item, CloseItemRequest request)
    {
        if (!WaitingAgentTask.Contains(item.Status))
            return Problem.Conflict($"{item.Id} is {Label(item.Status)}; only an open or blocked agent task can be cancelled.");

        return request.Decision == CloseDecision.Cancel ? null : Problem.Invalid($"\"{Label(request.Decision)}\" doesn't apply to an agent task; cancel it.");
    }

    private static async Task<Problem?> ProblemOfAsync(PowerLoomDbContext db, LocalItem item, CloseItemRequest request, CancellationToken cancellation)
    {
        if (item.Status is not (ItemStatus.Open or ItemStatus.InProgress))
            return Problem.Conflict($"{item.Id} is already {Label(item.Status)}.");

        if (!Decisions.TryGetValue(item.Kind, out var decisions) || !decisions.ContainsKey(request.Decision))
            return Problem.Invalid($"\"{Label(request.Decision)}\" doesn't apply to a {item.Kind}.");

        if (request.Decision == CloseDecision.Answer && string.IsNullOrWhiteSpace(request.Resolution) && !request.HasAttachment)
            return Problem.Invalid("Write an answer or attach a file.");

        var repoProblem = await RepoConfirmation.ProblemAsync(db, item, request, cancellation);

        return repoProblem is null ? null : Problem.Invalid(repoProblem);
    }

    private static string Label<T>(T value) where T : struct, Enum => new KebabCaseNameTranslator().TranslateMemberName(value.ToString());
}
