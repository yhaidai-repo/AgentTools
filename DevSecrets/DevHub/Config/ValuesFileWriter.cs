using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using DevSecrets.DevHub.Models;
using Microsoft.Extensions.Options;

namespace DevSecrets.DevHub.Config;

// Writes a values file: "$extends" first, then the names sorted, two-space JSON. The files are outside git, so every
// write first keeps the previous version in the backups folder (the newest few per file).
public sealed class ValuesFileWriter(IOptions<DevHubOptions> options, TimeProvider time)
{
    private const int BackupsKept = 20;

    // Connection strings keep their '+', '&' and quotes readable instead of \u escapes.
    private static readonly JsonSerializerOptions FileJson = new() { WriteIndented = true, NewLine = "\n", Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

    public void Write(string file, JsonObject values)
    {
        var path = Path.Combine(options.Value.ValuesDir, $"values.{file}.json");
        var temp = $"{path}.tmp";

        Backup(file, path);
        File.WriteAllText(temp, Sorted(values).ToJsonString(FileJson) + "\n");
        File.Move(temp, path, overwrite: true);
    }

    private static JsonObject Sorted(JsonObject values)
    {
        var sorted = new JsonObject();
        var extends = values[DevSecretsFiles.ExtendsKey];

        if (extends is not null)
            sorted[DevSecretsFiles.ExtendsKey] = extends.DeepClone();

        foreach (var value in values.Where(value => value.Key != DevSecretsFiles.ExtendsKey).OrderBy(value => value.Key, StringComparer.Ordinal))
            sorted[value.Key] = value.Value?.DeepClone();

        return sorted;
    }

    private void Backup(string file, string path)
    {
        var folder = Path.Combine(options.Value.ValuesDir, "backups");
        var stamp = time.GetLocalNow().ToString("yyyyMMdd-HHmmss-fff");

        Directory.CreateDirectory(folder);
        File.Copy(path, Path.Combine(folder, $"values.{file}.{stamp}.json"));
        DeleteOldBackups(folder, file);
    }

    private static void DeleteOldBackups(string folder, string file)
    {
        var old = Directory.GetFiles(folder, $"values.{file}.*.json").Order(StringComparer.Ordinal).SkipLast(BackupsKept);

        foreach (var backup in old)
            File.Delete(backup);
    }
}
