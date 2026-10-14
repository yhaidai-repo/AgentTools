using PowerLoom.AudioCapture.Models;
using PowerLoom.AudioCapture.Recording;
using PowerLoom.AudioCapture.Transcription;

namespace PowerLoom.AudioCapture;

// The commands of the spike (stage 1): record a session folder for N seconds, download a model, transcribe a session.
public static class CommandLine
{
    public static async Task<int> RunAsync(string[] args)
    {
        if (args.Length == 0)
        {
            PrintUsage();

            return 1;
        }

        var options = CommandOptions.Parse(args.Skip(1));

        return args[0] switch
        {
            "record" => await RecordAsync(options),
            "download-model" => await DownloadModelAsync(options),
            "transcribe" => await TranscribeAsync(options),
            _ => Unknown(args[0]),
        };
    }

    private static async Task<int> RecordAsync(CommandOptions options)
    {
        var folder = options.Positional(0) ?? SessionFolders.NewSessionFolder(options.Value("--title"));
        var seconds = int.Parse(options.Value("--seconds") ?? "0");

        using var recorder = new SessionRecorder(folder, echoCancellation: !options.Has("--no-aec"));

        recorder.Start();
        Console.WriteLine($"Recording into {folder} ({(seconds > 0 ? seconds + " s" : "until Enter")})");

        await WaitForStopAsync(seconds);

        var session = recorder.Stop();

        Console.WriteLine($"Stopped after {session.DurationSeconds:F0} s: {session.MicPath}, {session.SystemPath}");

        return 0;
    }

    private static async Task<int> DownloadModelAsync(CommandOptions options)
    {
        var model = WhisperModels.Parse(options.Positional(0));
        var path = await ModelStore.EnsureAsync(model, Console.WriteLine);

        Console.WriteLine($"Model ready: {path}");

        return 0;
    }

    private static async Task<int> TranscribeAsync(CommandOptions options)
    {
        var folder = options.Positional(0) ?? throw new ArgumentException("transcribe needs a session folder");
        var model = WhisperModels.Parse(options.Value("--model"));
        var prompt = options.Value("--prompt-file") is { } promptFile ? await File.ReadAllTextAsync(promptFile) : "";
        var transcription = new TranscriptionOptions(prompt.Trim(), NoContext: !options.Has("--with-context"));

        RuntimeSelection.Apply(options.Value("--runtime"));

        var modelPath = await ModelStore.EnsureAsync(model, Console.WriteLine);
        var transcriber = new SessionTranscriber(modelPath, transcription, Console.WriteLine);
        var result = await transcriber.TranscribeAsync(folder, model);

        Console.WriteLine($"Transcript: {result.MarkdownPath} ({result.Segments.Count} segments, runtime {RuntimeSelection.Loaded})");

        return 0;
    }

    private static async Task WaitForStopAsync(int seconds)
    {
        if (seconds > 0)
        {
            await Task.Delay(TimeSpan.FromSeconds(seconds));

            return;
        }

        await Task.Run(Console.ReadLine);
    }

    private static int Unknown(string command)
    {
        Console.Error.WriteLine($"Unknown command: {command}");
        PrintUsage();

        return 1;
    }

    private static void PrintUsage()
    {
        Console.WriteLine("""
            PowerLoom.AudioCapture <command>
              record [folder] [--title <text>] [--seconds <n>] [--no-aec]   mic + system audio into <folder>/mic.wav and system.wav
              download-model <large-v3|large-v3-turbo>              fetch the ggml model into the model store
              transcribe <folder> --model <name> [--runtime cuda|vulkan|cpu] [--prompt-file <path>] [--with-context]
            """);
    }
}
