using Whisper.net.LibraryLoader;

namespace PowerLoom.AudioCapture.Transcription;

// Which native whisper.cpp build runs: by default CUDA, then Vulkan, then CPU; `--runtime` pins one.
public static class RuntimeSelection
{
    private static readonly List<RuntimeLibrary> DefaultOrder = [RuntimeLibrary.Cuda, RuntimeLibrary.Vulkan, RuntimeLibrary.Cpu];

    public static string Loaded => RuntimeOptions.LoadedLibrary?.ToString() ?? "none";

    public static void Apply(string? runtime)
    {
        RuntimeOptions.RuntimeLibraryOrder = runtime is null ? DefaultOrder : [Parse(runtime)];
    }

    private static RuntimeLibrary Parse(string runtime) => runtime.ToLowerInvariant() switch
    {
        "cuda" => RuntimeLibrary.Cuda,
        "vulkan" => RuntimeLibrary.Vulkan,
        "cpu" => RuntimeLibrary.Cpu,
        _ => throw new ArgumentException($"Unknown runtime {runtime}; use cuda, vulkan or cpu"),
    };
}
