using PowerLoom.AudioCapture.Models;
using PowerLoom.AudioCapture.Settings;
using PowerLoom.AudioCapture.Transcription;

namespace PowerLoom.AudioCapture.Pipeline;

// The engine (model) of the resident process, the final pass after a recording and the hand-over to PowerLoom's inbox.
public sealed class MeetingPipeline(ToolSettings settings) : IDisposable
{
    private WhisperEngine? _engine;

    // Loads the model once (the first use takes seconds; the resident process does it at start, so live chunks don't wait).
    public async Task<WhisperEngine> EngineAsync()
    {
        if (_engine is not null)
            return _engine;

        RuntimeSelection.Apply(null);

        var modelPath = await ModelStore.EnsureAsync(WhisperModels.Parse(settings.Model), Log.Info);

        _engine = new WhisperEngine(modelPath, TranscriptionOptionsOf(settings));
        await _engine.LoadAsync();
        Log.Info($"Model {settings.Model} loaded on {RuntimeSelection.Loaded}");

        return _engine;
    }

    public async Task<(TranscriptResult Result, string InboxFile)> CompleteAsync(RecordingSession session)
    {
        var result = await TranscribeAsync(session.Folder);
        var import = MeetingImports.From(session, result, settings.Model);

        return (result, InboxWriter.Write(settings.InboxPath, import));
    }

    public async Task<TranscriptResult> TranscribeAsync(string folder)
    {
        var engine = await EngineAsync();
        var result = await new SessionTranscriber(engine, Log.Info).TranscribeAsync(folder);

        Log.Info($"Transcribed with {settings.Model} on {RuntimeSelection.Loaded}: {result.Segments.Count} segments");

        return result;
    }

    public void Dispose() => _engine?.Dispose();

    public static TranscriptionOptions TranscriptionOptionsOf(ToolSettings settings) =>
        new(SettingsStore.ReadPrompt(settings), Languages: TranscriptionOptions.ParseLanguages(settings.Languages));
}
