using PowerLoom.Contracts;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;

namespace PowerLoom.Domain.Tasks;

// Soft delete (user decision 2026-10-01): the item disappears from the pages, notes and blockers, but stays in the
// database so no agent creates it again and the history stays complete. A task an agent is working on can't be deleted.
public static class ItemDeletion
{
    private const string Actor = "human";

    // Every question and task may be deleted, a test, meeting or vault-review task and a task type of its own too; results
    // are agent output, not work items, and a review has its own delete.
    private static readonly string[] NotDeletable = [ItemKinds.ResearchResult, ItemKinds.TestReport, ItemKinds.DemonstrationResult, ItemKinds.Review];

    public static bool IsDeletable(LocalItem item) => IsDeletableKind(item.Kind) && item.Status is not (ItemStatus.InProgress or ItemStatus.Deleted);

    public static async Task<Outcome<string>> DeleteAsync(PowerLoomDbContext db, int? adoId, string itemId, CancellationToken cancellation)
    {
        var item = await ItemScope.FindAsync(db, adoId, itemId, cancellation);

        if (item is null || !IsDeletableKind(item.Kind))
            return Outcome<string>.Failure(Problem.NotFound($"{itemId} is not a question or task of {ItemScope.PbiLabel(adoId)}."));

        if (item.Status == ItemStatus.Deleted)
            return Outcome<string>.Failure(Problem.Conflict($"{itemId} is already deleted."));

        if (item.Status == ItemStatus.InProgress)
            return Outcome<string>.Failure(Problem.Conflict($"{itemId} is being worked on by an agent; try again when the run has ended."));

        await ItemStatusChange.SetAsync(db, item, ItemStatus.Deleted, Actor, null, cancellation);

        return Outcome<string>.Success(item.Id);
    }

    // A task of a type an agent created in the UI handles is deleted like research (user decision 2026-10-24).
    private static bool IsDeletableKind(string kind) => !NotDeletable.Contains(kind);
}
