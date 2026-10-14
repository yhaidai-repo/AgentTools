using PowerLoom.AudioCapture.Models;
using Whisper.net.Ggml;

namespace PowerLoom.AudioCapture.Transcription;

// Names on the command line ↔ ggml models.
public static class WhisperModels
{
    public static WhisperModel Parse(string? name) => name switch
    {
        null or "large-v3-turbo" => WhisperModel.LargeV3Turbo,
        "large-v3" => WhisperModel.LargeV3,
        _ => throw new ArgumentException($"Unknown model {name}; use large-v3 or large-v3-turbo"),
    };

    public static string FileName(WhisperModel model) => $"ggml-{Name(model)}.bin";

    public static string Name(WhisperModel model) => model == WhisperModel.LargeV3 ? "large-v3" : "large-v3-turbo";

    public static GgmlType GgmlType(WhisperModel model) =>
        model == WhisperModel.LargeV3 ? Whisper.net.Ggml.GgmlType.LargeV3 : Whisper.net.Ggml.GgmlType.LargeV3Turbo;
}
