using PowerLoom.Contracts;
using PowerLoom.Domain.Tasks.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;

namespace PowerLoom.Domain.Tasks;

// A person closing a question, finding or human task (PowerLoom's humanItems): checked before anything is stored, so a
// rejected request leaves no upload behind; status_history records the person as the actor.
public static class ItemClosing
{
    private const string Actor = "human";

    // Which decisions each human item kind takes, and the status each one leads to. A finding is closed with an answer
    // here; "submit to vault" goes through Docs / Records.
    private static readonly Dictionary<ItemKind, Dictionary<CloseDecision, ItemStatus>> Decisions = new()
    {
        [ItemKind.Question] = new() { [CloseDecision.Answer] = ItemStatus.Answered, [CloseDecision.Dismiss] = ItemStatus.Dismissed },
        [ItemKind.Finding] = new() { [CloseDecision.Answer] = ItemStatus.Answered, [CloseDecision.Dismiss] = ItemStatus.Dismissed },
        [ItemKind.Human] = new() { [CloseDecision.Done] = ItemStatus.Done, [CloseDecision.Cancel] = ItemStatus.Cancelled },
    };

    public static async Task<Outcome<LocalItem>> FindClosableAsync(PowerLoomDbContext db, CloseItemRequest request, CancellationToken cancellation)
    {
        var item = await ItemScope.FindAsync(db, request.AdoId, request.ItemId, cancellation);

        if (item is null || item.Assignee != HumanTasks.Assignee)
            return Outcome<LocalItem>.Failure(Problem.NotFound($"{request.ItemId} is not a question, human task or finding of {ItemScope.PbiLabel(request.AdoId)}."));

        var problem = await ProblemOfAsync(db, item, request, cancellation);

        return problem is null ? Outcome<LocalItem>.Success(item) : Outcome<LocalItem>.Failure(problem);
    }

    // Closes an item checked by FindClosableAsync; the new status.
    public static async Task<ItemStatus> CloseAsync(PowerLoomDbContext db, LocalItem item, CloseItemRequest request, CancellationToken cancellation)
    {
        var status = Decisions[item.Kind][request.Decision];

        item.Resolution = request.Resolution;

        await RepoConfirmation.ApplyAsync(db, item, request, cancellation);
        await ItemStatusChange.SetAsync(db, item, status, Actor, null, cancellation);

        return status;
    }

    private static async Task<Problem?> ProblemOfAsync(PowerLoomDbContext db, LocalItem item, CloseItemRequest request, CancellationToken cancellation)
    {
        if (item.Status is not (ItemStatus.Open or ItemStatus.InProgress))
            return Problem.Conflict($"{item.Id} is already {Label(item.Status)}.");

        if (!Decisions.TryGetValue(item.Kind, out var decisions) || !decisions.ContainsKey(request.Decision))
            return Problem.Invalid($"\"{Label(request.Decision)}\" doesn't apply to a {Label(item.Kind)}.");

        if (request.Decision == CloseDecision.Answer && string.IsNullOrWhiteSpace(request.Resolution) && !request.HasAttachment)
            return Problem.Invalid("Write an answer or attach a file.");

        var repoProblem = await RepoConfirmation.ProblemAsync(db, item, request, cancellation);

        return repoProblem is null ? null : Problem.Invalid(repoProblem);
    }

    private static string Label<T>(T value) where T : struct, Enum => new KebabCaseNameTranslator().TranslateMemberName(value.ToString());
}
