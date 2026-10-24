using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;
using PowerLoom.Infrastructure.Mcp;

namespace PowerLoom.Features.Vaults.Add;

public sealed class CodexConfigFile(IOptions<McpOptions> options)
{
    public const string FileName = ".codex/config.toml";
    private static readonly Regex Header = new(@"^\s*\[\[?\s*(?<name>(?:""(?:[^""\\]|\\.)*""|'[^']*'|[A-Za-z0-9_-]+)(?:\s*\.\s*(?:""(?:[^""\\]|\\.)*""|'[^']*'|[A-Za-z0-9_-]+))*)\s*\]\]?\s*(?:#.*)?$", RegexOptions.CultureInvariant);

    public async Task<bool> EnsureAsync(string root, string vault, CancellationToken cancellation)
    {
        if (!options.Value.IsConfigured)
            return false;

        var path = Path.Combine(root, ".codex", "config.toml");
        var bytes = File.Exists(path) ? await File.ReadAllBytesAsync(path, cancellation) : [];
        var hasBom = bytes.AsSpan().StartsWith(Encoding.UTF8.Preamble);
        var text = Encoding.UTF8.GetString(hasBom ? bytes.AsSpan(Encoding.UTF8.Preamble.Length) : bytes);
        var replacement = ReplaceTable(text, Entry(vault, NewLineOf(text)));

        if (replacement == text)
            return false;

        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        await File.WriteAllTextAsync(path, replacement, new UTF8Encoding(hasBom), cancellation);

        return true;
    }

    private string Entry(string vault, string newLine)
    {
        return string.Join(newLine,
        [
            "[mcp_servers.powerloom]",
            $"url = {Quote(options.Value.Url)}",
            $"http_headers = {{ \"Authorization\" = {Quote($"Bearer {options.Value.Token}")}, \"X-PowerLoom-Vault\" = {Quote(vault)} }}",
            "",
        ]);
    }

    private static string ReplaceTable(string text, string entry)
    {
        var lines = Regex.Matches(text, @"[^\r\n]*(?:\r\n|\n|\r|$)").Where(match => match.Length > 0);
        var result = new StringBuilder();
        var inOwnedTable = false;
        var replaced = false;
        var multiline = "";

        foreach (var line in lines)
            AppendLine(result, line.Value, entry, ref inOwnedTable, ref replaced, ref multiline);

        if (!replaced)
            AppendEntry(result, entry);

        return result.ToString();
    }

    private static void AppendLine(StringBuilder result, string line, string entry, ref bool inOwnedTable, ref bool replaced, ref string multiline)
    {
        var header = multiline.Length == 0 ? Header.Match(line.TrimEnd('\r', '\n')) : Match.Empty;

        if (header.Success)
        {
            inOwnedTable = IsOwnedTable(header.Groups["name"].Value);
            AppendOwnedEntry(result, entry, inOwnedTable, ref replaced);
        }

        multiline = MultilineAfter(line, multiline);

        if (!inOwnedTable)
            result.Append(line);
    }

    private static void AppendOwnedEntry(StringBuilder result, string entry, bool owned, ref bool replaced)
    {
        if (!owned || replaced)
            return;

        result.Append(entry);
        replaced = true;
    }

    private static bool IsOwnedTable(string name)
    {
        var parts = Regex.Matches(name, @"""(?:[^""\\]|\\.)*""|'[^']*'|[A-Za-z0-9_-]+").Select(match => KeyOf(match.Value)).ToArray();

        return parts.Length >= 2 && parts[0] == "mcp_servers" && parts[1] == "powerloom";
    }

    private static string KeyOf(string value)
    {
        if (value.StartsWith('\''))
            return value[1..^1];

        if (value.StartsWith('"'))
            return Regex.Replace(value[1..^1], @"\\(?:u(?<hex>[0-9A-Fa-f]{4})|U(?<hex>[0-9A-Fa-f]{8}))", match => char.ConvertFromUtf32(Convert.ToInt32(match.Groups["hex"].Value, 16)));

        return value;
    }

    private static string MultilineAfter(string line, string delimiter)
    {
        var quote = '\0';

        for (var index = 0; index < line.Length; index++)
            ScanQuote(line, ref index, ref quote, ref delimiter);

        return delimiter;
    }

    private static void ScanQuote(string line, ref int index, ref char quote, ref string delimiter)
    {
        if (delimiter.Length > 0)
        {
            ScanMultiline(line, ref index, ref delimiter);

            return;
        }

        if (quote != '\0')
        {
            ScanSingleLine(line, ref index, ref quote);

            return;
        }

        if (line[index] == '#')
        {
            index = line.Length;

            return;
        }

        if (line[index] != '"' && line[index] != '\'')
            return;

        var triple = new string(line[index], 3);

        if (line.AsSpan(index).StartsWith(triple))
        {
            delimiter = triple;
            index += 2;

            return;
        }

        quote = line[index];
    }

    private static void ScanMultiline(string line, ref int index, ref string delimiter)
    {
        if (delimiter == "\"\"\"" && line[index] == '\\')
        {
            index++;

            return;
        }

        if (!line.AsSpan(index).StartsWith(delimiter))
            return;

        index += 2;
        delimiter = "";
    }

    private static void ScanSingleLine(string line, ref int index, ref char quote)
    {
        if (quote == '"' && line[index] == '\\')
        {
            index++;

            return;
        }

        if (line[index] == quote)
            quote = '\0';
    }

    private static void AppendEntry(StringBuilder result, string entry)
    {
        if (result.Length > 0 && result[^1] != '\n' && result[^1] != '\r')
            result.Append(NewLineOf(result.ToString()));

        result.Append(entry);
    }

    private static string NewLineOf(string text)
    {
        return text.Contains("\r\n", StringComparison.Ordinal) ? "\r\n" : "\n";
    }

    private static string Quote(string text)
    {
        // JSON basic-string escapes are valid TOML except JSON's optional escaped slash, which this writer never emits.
        return JsonSerializer.Serialize(text, new JsonSerializerOptions { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping });
    }
}
