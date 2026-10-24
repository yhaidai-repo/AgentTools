using System.Diagnostics.CodeAnalysis;

namespace PowerLoom.Contracts;

// The result of an operation that can fail in an expected way: a value, or the problem to report.
public sealed class Outcome<T>
    where T : notnull
{
    private Outcome(T? value, Problem? problem)
    {
        Value = value;
        Problem = problem;
    }

    public T? Value { get; }

    public Problem? Problem { get; }

    [MemberNotNullWhen(true, nameof(Value))]
    [MemberNotNullWhen(false, nameof(Problem))]
    public bool Ok => Problem is null;

    public static Outcome<T> Success(T value) => new(value, null);

    public static Outcome<T> Failure(Problem problem) => new(default, problem);
}
