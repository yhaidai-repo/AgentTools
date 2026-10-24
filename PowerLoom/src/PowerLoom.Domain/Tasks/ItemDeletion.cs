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
    private static readonly string[] Deletable = [ItemKinds.Question, ItemKinds.Human, ItemKinds.Finding, ItemKinds.Research, ItemKinds.Refinement, ItemKinds.Design, ItemKinds.Docs];

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
    private static bool IsDeletableKind(string kind) => Deletable.Contains(kind) || !ItemKinds.IsBuiltIn(kind);
}
