using System.Text;
using Npgsql;

namespace PowerLoom.Persistence.Enums;

// PowerLoom's enum labels are kebab-case (`ready-for-dev`); Npgsql's default translator makes snake_case.
public sealed class KebabCaseNameTranslator : INpgsqlNameTranslator
{
    public string TranslateTypeName(string clrName) => TranslateMemberName(clrName);

    public string TranslateMemberName(string clrName)
    {
        var label = new StringBuilder(clrName.Length + 4);

        foreach (var (letter, index) in clrName.Select((letter, index) => (letter, index)))
            AppendLetter(label, letter, index);

        return label.ToString();
    }

    private static void AppendLetter(StringBuilder label, char letter, int index)
    {
        if (char.IsUpper(letter) && index > 0)
            label.Append('-');

        label.Append(char.ToLowerInvariant(letter));
    }
}
