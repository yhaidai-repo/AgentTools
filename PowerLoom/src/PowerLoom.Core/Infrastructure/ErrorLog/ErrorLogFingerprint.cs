using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace PowerLoom.Infrastructure.ErrorLog;

// What merges repeats into one row, computed as @powerloom/core's logFingerprint does: the service, level, task and the
// message with its numbers left out. The stored message is cut to MaxMessage characters.
public static partial class ErrorLogFingerprint
{
    public const int MaxMessage = 2000;

    public static string MessageOf(string message) => message.Length > MaxMessage ? string.Concat(message.AsSpan(0, MaxMessage - 1), "…") : message;

    public static string Of(string service, string level, string? taskId, string message)
    {
        var text = string.Join("|", service, level, taskId ?? "", Numbers().Replace(MessageOf(message), "#"));

        return Convert.ToHexStringLower(SHA1.HashData(Encoding.UTF8.GetBytes(text)));
    }

    [GeneratedRegex(@"\d+")]
    private static partial Regex Numbers();
}
