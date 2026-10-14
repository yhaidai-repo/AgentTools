namespace PowerLoom.AudioCapture;

// `--name value` pairs and the positional arguments of one command.
public sealed class CommandOptions
{
    private readonly Dictionary<string, string> _values = new(StringComparer.OrdinalIgnoreCase);
    private readonly List<string> _positional = [];
    private readonly HashSet<string> _flags = new(StringComparer.OrdinalIgnoreCase);

    public static CommandOptions Parse(IEnumerable<string> args)
    {
        var options = new CommandOptions();
        string? pendingName = null;

        foreach (var arg in args)
        {
            pendingName = options.Take(arg, pendingName);
        }

        if (pendingName is not null)
            options._flags.Add(pendingName);

        return options;
    }

    public string? Value(string name) => _values.GetValueOrDefault(name);

    public bool Has(string flag) => _flags.Contains(flag);

    public string? Positional(int index) => index < _positional.Count ? _positional[index] : null;

    private string? Take(string arg, string? pendingName)
    {
        if (pendingName is not null && arg.StartsWith("--", StringComparison.Ordinal))
            _flags.Add(pendingName);
        else if (pendingName is not null)
        {
            _values[pendingName] = arg;

            return null;
        }

        if (arg.StartsWith("--", StringComparison.Ordinal))
            return arg;

        _positional.Add(arg);

        return null;
    }
}
