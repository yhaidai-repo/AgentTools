using PowerLoom.Contracts;
using PowerLoom.Domain.Pbis;

namespace PowerLoom.Features.Tasks.CreateTask;

// The PBI field of the task form: blank means none; anything else must name one (a link or an id).
public static class OptionalPbi
{
    public static Problem? Parse(string? text, out int? adoId)
    {
        var isBlank = string.IsNullOrWhiteSpace(text);

        adoId = isBlank ? null : PbiReference.Parse(text!);

        return !isBlank && adoId is null ? Problem.Invalid($"Not a PBI link or id: {text}") : null;
    }
}
