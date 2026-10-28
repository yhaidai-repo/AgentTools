using System.Text.RegularExpressions;
using PowerLoom.Infrastructure.VaultScan.Models;

namespace PowerLoom.Infrastructure.VaultScan;

public static partial class RecordWorkReferences
{
    public static bool ValidId(string? id) => id is null || SafeId().IsMatch(id);

    public static string? Line(string action, RecordWorkContext? context, DateOnly date)
    {
        if (context is null) return null;
        var parts = new List<string>();
        if (context.PbiId is > 0) parts.Add($"pbi:{context.PbiId}");
        if (context.TaskId is { } task && ValidId(task)) parts.Add($"task:{task}");
        if (context.ChatId is { } chat && ValidId(chat)) parts.Add($"chat:{chat}");
        else if (context.SessionId is { } session && ValidId(session)) parts.Add($"session:{session}");
        return parts.Count == 0 ? null : $"- {action} in: {date:yyyy-MM-dd} · {string.Join(" · ", parts)}";
    }

    public static string AppendUpdate(string record, RecordWorkContext? context, DateOnly date, string eol)
    {
        var line = Line("Updated", context, date);
        return line is null || record.Split(["\r\n", "\n"], StringSplitOptions.None).Contains(line)
            ? record : $"{record.TrimEnd()}{eol}{line}";
    }

    [GeneratedRegex(@"\A[a-zA-Z0-9][a-zA-Z0-9._:-]{0,199}\z")]
    private static partial Regex SafeId();
}
