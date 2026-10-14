using PowerLoom.AudioCapture.Models;
using Whisper.net.Ggml;

namespace PowerLoom.AudioCapture.Transcription;

// ggml models under <home>/models, fetched once from Hugging Face (ggerganov/whisper.cpp).
public static class ModelStore
{
    public static string Root => Path.Combine(AppPaths.Home, "models");

    public static async Task<string> EnsureAsync(WhisperModel model, Action<string> log)
    {
        var path = Path.Combine(Root, WhisperModels.FileName(model));

        if (File.Exists(path))
            return path;

        log($"Downloading {WhisperModels.Name(model)} into {Root} …");
        await DownloadAsync(model, path);
        log($"Downloaded {new FileInfo(path).Length / 1_000_000} MB");

        return path;
    }

    private static async Task DownloadAsync(WhisperModel model, string path)
    {
        Directory.CreateDirectory(Root);

        var partial = path + ".part";

        await using (var source = await WhisperGgmlDownloader.Default.GetGgmlModelAsync(WhisperModels.GgmlType(model)))
        await using (var target = File.Create(partial))
        {
            await source.CopyToAsync(target);
        }

        File.Move(partial, path, overwrite: true);
    }
}
