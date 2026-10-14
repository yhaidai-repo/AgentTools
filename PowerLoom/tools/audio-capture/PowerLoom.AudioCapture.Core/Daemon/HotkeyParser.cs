namespace PowerLoom.AudioCapture.Daemon;

// "Ctrl+Alt+R" → Win32 modifier flags and the virtual key of the letter or digit.
public static class HotkeyParser
{
    private static readonly Dictionary<string, uint> Modifiers = new(StringComparer.OrdinalIgnoreCase)
    {
        ["alt"] = 0x0001,
        ["ctrl"] = 0x0002,
        ["control"] = 0x0002,
        ["shift"] = 0x0004,
        ["win"] = 0x0008,
    };

    public static (uint Modifiers, uint Key) Parse(string hotkey)
    {
        var parts = hotkey.Split('+', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        var key = parts.LastOrDefault() ?? throw new ArgumentException($"Empty hotkey '{hotkey}'");
        var modifiers = parts.Take(parts.Length - 1).Aggregate(0u, (flags, name) => flags | ModifierFlag(name, hotkey));

        return (modifiers, KeyCode(key, hotkey));
    }

    private static uint ModifierFlag(string name, string hotkey) =>
        Modifiers.TryGetValue(name, out var flag) ? flag : throw new ArgumentException($"Unknown modifier '{name}' in hotkey '{hotkey}'");

    // Letters and digits share their ASCII code with their virtual key; F-keys start at 0x70.
    private static uint KeyCode(string key, string hotkey)
    {
        if (key.Length == 1 && char.IsAsciiLetterOrDigit(key[0]))
            return char.ToUpperInvariant(key[0]);

        if (key.Length > 1 && key[0] is 'F' or 'f' && int.TryParse(key[1..], out var number) && number is >= 1 and <= 24)
            return (uint)(0x70 + number - 1);

        throw new ArgumentException($"Unsupported key '{key}' in hotkey '{hotkey}'; use a letter, digit or F1–F24");
    }
}
