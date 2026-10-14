using System.Text.Encodings.Web;
using System.Text.Json;
using PowerLoom.AudioCapture.Models;

namespace PowerLoom.AudioCapture.Settings;

public static class SettingsStore
{
    private static readonly JsonSerializerOptions Json = new() { WriteIndented = true, Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

    public static string FilePath => Path.Combine(AppPaths.Home, "settings.json");

    // The default Whisper prompt: a mixed-language sentence with tech terms steers the languages and the spelling of terms.
    private const string DefaultPrompt =
        "Обговорюємо backlog refinement, pull request і deployment на Azure DevOps. Иногда говорим по-русски, sometimes in English: Kubernetes, PBI, sprint planning, code review.";

    public static ToolSettings Load()
    {
        if (!File.Exists(FilePath))
            throw new InvalidOperationException($"No settings at {FilePath}: run `install --inbox <path>` first");

        return JsonSerializer.Deserialize<ToolSettings>(File.ReadAllText(FilePath), Json)
            ?? throw new InvalidOperationException($"Unreadable settings at {FilePath}");
    }

    public static void Save(ToolSettings settings)
    {
        Directory.CreateDirectory(AppPaths.Home);
        File.WriteAllText(FilePath, JsonSerializer.Serialize(settings, Json));
        EnsurePrompt(settings);
    }

    public static string PromptPath(ToolSettings settings) => Path.Combine(AppPaths.Home, settings.PromptFile);

    public static string ReadPrompt(ToolSettings settings)
    {
        var path = PromptPath(settings);

        return File.Exists(path) ? File.ReadAllText(path).Trim() : "";
    }

    private static void EnsurePrompt(ToolSettings settings)
    {
        var path = PromptPath(settings);

        if (!File.Exists(path))
            File.WriteAllText(path, DefaultPrompt + Environment.NewLine);
    }
}
