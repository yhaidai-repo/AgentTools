using PowerLoom.AudioCapture.Models;
using PowerLoom.AudioCapture.Pipeline;
using PowerLoom.AudioCapture.Recording;
using PowerLoom.AudioCapture.Speakers;
using PowerLoom.AudioCapture.Transcription;

namespace PowerLoom.AudioCapture.Commands;

// `transcribe`, `download-model` and the fixed-length `record-for`: the pieces on their own, for checks and re-runs.
public static class TranscribeCommands
{
    public static async Task<int> TranscribeAsync(CommandOptions options)
    {
        var folder = options.Positional(0) ?? throw new ArgumentException("transcribe needs a session folder");
        var model = WhisperModels.Parse(options.Value("--model"));
        var prompt = options.Value("--prompt-file") is { } promptFile ? await File.ReadAllTextAsync(promptFile) : "";
        var transcription = new TranscriptionOptions(prompt.Trim(), NoContext: !options.Has("--with-context"), Languages: TranscriptionOptions.ParseLanguages(options.Value("--languages") ?? "uk,ru,en"));

        RuntimeSelection.Apply(options.Value("--runtime"));

        var modelPath = await ModelStore.EnsureAsync(model, Console.WriteLine);

        using var engine = new WhisperEngine(modelPath, transcription);

        var speakerTools = options.Has("--no-speakers") ? null : await LoadSpeakerToolsAsync();
        var result = await new SessionTranscriber(engine, speakerTools, Console.WriteLine).TranscribeAsync(folder);

        Console.WriteLine($"Transcript: {result.MarkdownPath} ({result.Segments.Count} segments, runtime {RuntimeSelection.Loaded})");

        return options.Value("--inbox") is { } inbox ? SendToInbox(folder, inbox, result, model) : 0;
    }

    public static async Task<SpeakerTools> LoadSpeakerToolsAsync()
    {
        await SpeakerModels.EnsureAsync(Console.WriteLine);

        return new SpeakerTools(new SpeakerDiarizer(SpeakerModels.SegmentationPath, SpeakerModels.EmbeddingPath), new VoiceEmbedder(SpeakerModels.EmbeddingPath), new VoiceStore(new VoiceSpace()));
    }

    public static int Devices()
    {
        foreach (var line in AudioDevices.Describe())
        {
            Console.WriteLine(line);
        }

        return 0;
    }

    public static async Task<int> DownloadModelAsync(CommandOptions options)
    {
        var path = await ModelStore.EnsureAsync(WhisperModels.Parse(options.Positional(0)), Console.WriteLine);

        Console.WriteLine($"Model ready: {path}");

        return 0;
    }

    public static async Task<int> RecordForAsync(CommandOptions options)
    {
        var seconds = int.Parse(options.Positional(0) ?? throw new ArgumentException("record-for needs the seconds"));
        var folder = SessionFolders.NewSessionFolder(options.Value("--title"));

        using var recorder = new SessionRecorder(folder, options.Value("--title") ?? "test", CaptureSelection.None, echoCancellation: !options.Has("--no-aec"));

        recorder.Start();
        Console.WriteLine($"Recording into {folder} for {seconds} s");
        await Task.Delay(TimeSpan.FromSeconds(seconds));

        var session = recorder.Stop();

        Console.WriteLine($"Stopped after {session.DurationSeconds:F0} s: {session.Folder}");

        return 0;
    }

    private static int SendToInbox(string folder, string inbox, TranscriptResult result, WhisperModel model)
    {
        var session = RecordingSession.Load(folder);
        var import = MeetingImports.From(session, result, WhisperModels.Name(model));

        Console.WriteLine($"Inbox: {InboxWriter.Write(inbox, import)}");

        return 0;
    }
}
