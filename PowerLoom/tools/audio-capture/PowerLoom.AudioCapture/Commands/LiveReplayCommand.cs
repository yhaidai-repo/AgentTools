using System.Diagnostics;
using PowerLoom.AudioCapture.Live;
using PowerLoom.AudioCapture.Models;
using PowerLoom.AudioCapture.Recording;
using PowerLoom.AudioCapture.Speakers;
using PowerLoom.AudioCapture.Transcription;

namespace PowerLoom.AudioCapture.Commands;

// `live-replay <folder>`: pushes a finished session's mic.wav and system.wav through the live path (pause detection,
// chunked transcription, echo drop) as fast as the GPU allows and prints each segment as it would have appeared.
public static class LiveReplayCommand
{
    public static async Task<int> RunAsync(CommandOptions options)
    {
        var folder = options.Positional(0) ?? throw new ArgumentException("live-replay needs a session folder");
        var model = WhisperModels.Parse(options.Value("--model"));
        var prompt = options.Value("--prompt-file") is { } promptFile ? await File.ReadAllTextAsync(promptFile) : "";
        var transcription = new TranscriptionOptions(prompt.Trim(), Languages: TranscriptionOptions.ParseLanguages(options.Value("--languages") ?? "uk,ru,en"));

        RuntimeSelection.Apply(options.Value("--runtime"));

        using var engine = new WhisperEngine(await ModelStore.EnsureAsync(model, Console.WriteLine), transcription);

        var speakerTools = options.Has("--no-speakers") ? null : await TranscribeCommands.LoadSpeakerToolsAsync();
        var count = await ReplayAsync(folder, engine, speakerTools?.NewLiveSpeakers());

        Console.WriteLine($"{count} live segments (runtime {RuntimeSelection.Loaded})");

        return 0;
    }

    private static async Task<int> ReplayAsync(string folder, WhisperEngine engine, LiveSpeakers? speakers)
    {
        var live = new LiveTranscriber(engine, speakers);

        if (speakers is not null)
            speakers.Changed += list => Console.WriteLine($"-- voices: {string.Join(", ", list.Select(s => s.Label))}");
        var watch = Stopwatch.StartNew();
        var count = 0;

        live.Segment += segment => count += Print(segment, watch.Elapsed);

        Feed(Path.Combine(folder, "mic.wav"), SessionRecorder.MicChannel, live);
        Feed(Path.Combine(folder, "system.wav"), SessionRecorder.SystemChannel, live);
        await live.CompleteAsync();

        return count;
    }

    private static void Feed(string wavPath, string speaker, LiveTranscriber live)
    {
        var chunks = WavChunks.Read(wavPath, speaker);

        foreach (var chunk in chunks)
        {
            live.Enqueue(chunk);
        }

        Console.WriteLine($"-- {speaker}: {chunks.Count} chunks, {chunks.Sum(c => c.Samples.Length) / 16000.0:F0} s of speech");
    }

    private static int Print(TranscriptSegment segment, TimeSpan wallClock)
    {
        Console.WriteLine($"[{segment.Start:hh\\:mm\\:ss}] {segment.Speaker} ({segment.Language}, +{wallClock.TotalSeconds:F1} s): {segment.Text}");

        return 1;
    }
}
