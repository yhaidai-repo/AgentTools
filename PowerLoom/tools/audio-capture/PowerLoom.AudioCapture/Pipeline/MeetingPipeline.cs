using PowerLoom.AudioCapture.Models;
using PowerLoom.AudioCapture.Settings;
using PowerLoom.AudioCapture.Transcription;

namespace PowerLoom.AudioCapture.Pipeline;

// After a recording: transcribe both channels with the configured model, then drop the meeting into PowerLoom's inbox.
public sealed class MeetingPipeline(ToolSettings settings)
{
    public async Task<string> CompleteAsync(RecordingSession session, string title)
    {
        var result = await TranscribeAsync(session.Folder);
        var import = MeetingImports.From(session, title, result, settings.Model);

        return InboxWriter.Write(settings.InboxPath, import);
    }

    public async Task<TranscriptResult> TranscribeAsync(string folder)
    {
        var model = WhisperModels.Parse(settings.Model);
        var modelPath = await ModelStore.EnsureAsync(model, Log.Info);
        var options = new TranscriptionOptions(SettingsStore.ReadPrompt(settings));
        var transcriber = new SessionTranscriber(modelPath, options, Log.Info);

        return await transcriber.TranscribeAsync(folder);
    }
}
