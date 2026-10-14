using PowerLoom.AudioCapture.Models;
using PowerLoom.AudioCapture.Settings;
using PowerLoom.AudioCapture.Speakers;
using PowerLoom.AudioCapture.Transcription;

namespace PowerLoom.AudioCapture.Pipeline;

// The models of the resident process (Whisper engine, speaker tools), the final pass after a recording and the
// hand-over to PowerLoom's inbox.
public sealed class MeetingPipeline(ToolSettings settings) : IDisposable
{
    private WhisperEngine? _engine;
    private SpeakerTools? _speakerTools;
    private bool _speakerToolsFailed;

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

    // The speaker models are optional: a download or load failure is logged once and the others stay "Them".
    public SpeakerTools? LoadedSpeakerTools => _speakerTools;

    public async Task<SpeakerTools?> SpeakerToolsAsync()
    {
        if (_speakerTools is not null || _speakerToolsFailed)
            return _speakerTools;

        try
        {
            _speakerTools = await LoadSpeakerToolsAsync();
        }
        catch (Exception exception)
        {
            _speakerToolsFailed = true;
            Log.Error("Speaker models unavailable; voices stay unnamed", exception);
        }

        return _speakerTools;
    }

    // At Stop: the live transcript is written as it is and handed over at once (no second pass; user, 2026-10-14).
    public (TranscriptResult Result, string InboxFile) Complete(RecordingSession session, IReadOnlyList<TranscriptSegment> segments)
    {
        var result = TranscriptFiles.Write(session.Folder, segments);
        var import = MeetingImports.From(session, result, settings.Model);

        return (result, InboxWriter.Write(settings.InboxPath, import));
    }

    public async Task<TranscriptResult> TranscribeAsync(string folder)
    {
        var engine = await EngineAsync();
        var speakerTools = await SpeakerToolsAsync();
        var result = await new SessionTranscriber(engine, speakerTools, Log.Info).TranscribeAsync(folder);

        Log.Info($"Transcribed with {settings.Model} on {RuntimeSelection.Loaded}: {result.Segments.Count} segments");

        return result;
    }

    public void Dispose()
    {
        _engine?.Dispose();
        _speakerTools?.Diarizer.Dispose();
        _speakerTools?.Embedder.Dispose();
    }

    public static TranscriptionOptions TranscriptionOptionsOf(ToolSettings settings) =>
        new(SettingsStore.ReadPrompt(settings), Languages: TranscriptionOptions.ParseLanguages(settings.Languages));

    private static async Task<SpeakerTools> LoadSpeakerToolsAsync()
    {
        await SpeakerModels.EnsureAsync(Log.Info);

        var tools = await Task.Run(() => new SpeakerTools(
            new SpeakerDiarizer(SpeakerModels.SegmentationPath, SpeakerModels.EmbeddingPath),
            new VoiceEmbedder(SpeakerModels.EmbeddingPath),
            new VoiceStore(new VoiceSpace())));

        Log.Info($"Speaker models loaded; {tools.Store.Names.Count} named voices");

        return tools;
    }
}
