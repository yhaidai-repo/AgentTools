using PowerLoom.Persistence.Enums;

namespace PowerLoom.Domain.Tasks;

// Task types as AgentConfig names them (an agent's `handles`): the item kinds' labels in the database, e.g. "vault-review".
public static class TaskKinds
{
    private static readonly KebabCaseNameTranslator Labels = new();

    public static string Label(ItemKind kind) => Labels.TranslateMemberName(kind.ToString());

    public static IReadOnlyList<ItemKind> Parse(IEnumerable<string> labels)
    {
        var wanted = labels.ToHashSet();

        return Enum.GetValues<ItemKind>().Where(kind => wanted.Contains(Label(kind))).ToList();
    }
}
