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

    // Questions and tasks the user may delete; results and refinements are agent output, not work items.
    private static readonly ItemKind[] Deletable = [ItemKind.Question, ItemKind.Human, ItemKind.Finding, ItemKind.Research, ItemKind.Refinement, ItemKind.Design, ItemKind.Docs];

    public static bool IsDeletable(LocalItem item) => Deletable.Contains(item.Kind) && item.Status is not (ItemStatus.InProgress or ItemStatus.Deleted);

    public static async Task<Outcome<string>> DeleteAsync(PowerLoomDbContext db, int? adoId, string itemId, CancellationToken cancellation)
    {
        var item = await ItemScope.FindAsync(db, adoId, itemId, cancellation);

        if (item is null || !Deletable.Contains(item.Kind))
            return Outcome<string>.Failure(Problem.NotFound($"{itemId} is not a question or task of {ItemScope.PbiLabel(adoId)}."));

        if (item.Status == ItemStatus.Deleted)
            return Outcome<string>.Failure(Problem.Conflict($"{itemId} is already deleted."));

        if (item.Status == ItemStatus.InProgress)
            return Outcome<string>.Failure(Problem.Conflict($"{itemId} is being worked on by an agent; try again when the run has ended."));

        await ItemStatusChange.SetAsync(db, item, ItemStatus.Deleted, Actor, null, cancellation);

        return Outcome<string>.Success(item.Id);
    }
}
