using PowerLoom.AudioCapture.Control;
using PowerLoom.AudioCapture.Daemon;
using PowerLoom.AudioCapture.Settings;

namespace PowerLoom.AudioCapture.Commands;

// `run`, `record start|stop`, `status`, `quit`: the resident process and the CLI that drives it.
public static class RecordCommands
{
    public static async Task<int> RunAsync()
    {
        using var cancellation = new CancellationTokenSource();

        Console.CancelKeyPress += (_, e) => Cancel(e, cancellation);

        await new RecorderDaemon(SettingsStore.Load()).RunAsync(cancellation.Token);

        return 0;
    }

    public static async Task<int> RecordAsync(CommandOptions options) => options.Positional(0) switch
    {
        "start" => await StartAsync(options.Value("--title")),
        "stop" => await StopAsync(),
        _ => Fail("record needs `start [--title <text>]` or `stop`"),
    };

    public static int Status()
    {
        var state = StateStore.Load();

        if (!StateStore.IsDaemonAlive(state))
            return Say("Not running");

        var recording = state!.RecordingFolder is null ? "idle" : $"recording '{state.RecordingTitle}' since {state.RecordingStartedAt:HH:mm}";

        return Say($"Running (pid {state.Pid}), {recording}; last result: {state.LastResult ?? "none"}");
    }

    public static async Task<int> QuitAsync() =>
        await DaemonClient.RequestQuitAsync() ? Say("Stopped the resident process") : Fail("The resident process didn't quit in time");

    private static async Task<int> StartAsync(string? title)
    {
        SettingsStore.Load();

        return await DaemonClient.RequestStartAsync(title) ? Say($"Recording: {StateStore.Load()?.RecordingTitle}") : Fail("Recording didn't start; see audio-capture.log");
    }

    private static async Task<int> StopAsync() =>
        await DaemonClient.RequestStopAsync() ? Say("Stopped; transcribing in the background (see `status`)") : Fail("Nothing to stop (no resident process or it didn't answer)");

    private static void Cancel(ConsoleCancelEventArgs e, CancellationTokenSource cancellation)
    {
        e.Cancel = true;
        cancellation.Cancel();
    }

    private static int Say(string message)
    {
        Console.WriteLine(message);

        return 0;
    }

    private static int Fail(string message)
    {
        Console.Error.WriteLine(message);

        return 1;
    }
}
