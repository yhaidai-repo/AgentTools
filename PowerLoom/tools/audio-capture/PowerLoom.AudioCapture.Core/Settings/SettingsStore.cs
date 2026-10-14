using System.Text.Encodings.Web;
using System.Text.Json;
using PowerLoom.AudioCapture.Models;

namespace PowerLoom.AudioCapture.Settings;

public static class SettingsStore
{
    private static readonly JsonSerializerOptions Json = new() { WriteIndented = true, Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

    public static string FilePath => Path.Combine(AppPaths.Home, "settings.json");

    // The default Whisper prompt: a list of terms only. A sentence in one of the meeting languages biased short chunks
    // toward that language (a Russian speaker came out half Ukrainian, 2026-10-14); plain terms keep the spelling right.
    private const string DefaultPrompt =
        "Azure DevOps, backlog refinement, pull request, deployment, Kubernetes, PBI, sprint planning, code review, Angular, exception handler, API, endpoint.";

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
