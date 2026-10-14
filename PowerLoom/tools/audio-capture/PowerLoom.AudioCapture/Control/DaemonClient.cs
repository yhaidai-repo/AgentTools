using System.Diagnostics;
using System.Text.Json;
using PowerLoom.AudioCapture.Models;

namespace PowerLoom.AudioCapture.Control;

// The CLI side: starts the resident process when needed and hands it start / stop / quit requests.
public static class DaemonClient
{
    private static readonly TimeSpan Patience = TimeSpan.FromSeconds(20);

    public static async Task<bool> RequestStartAsync(string? title)
    {
        await EnsureRunningAsync();

        Directory.CreateDirectory(ControlFiles.Root);
        File.WriteAllText(ControlFiles.StartRequest, JsonSerializer.Serialize(new StartRequest(title)));

        return await WaitAsync(state => state?.RecordingFolder is not null);
    }

    public static async Task<bool> RequestStopAsync()
    {
        if (!StateStore.IsDaemonAlive(StateStore.Load()))
            return false;

        ControlFiles.Touch(ControlFiles.StopRequest);

        return await WaitAsync(state => state?.RecordingFolder is null);
    }

    public static async Task<bool> RequestQuitAsync()
    {
        if (!StateStore.IsDaemonAlive(StateStore.Load()))
            return true;

        ControlFiles.Touch(ControlFiles.QuitRequest);

        return await WaitAsync(state => !StateStore.IsDaemonAlive(state));
    }

    private static async Task EnsureRunningAsync()
    {
        if (StateStore.IsDaemonAlive(StateStore.Load()))
            return;

        StartDetached();

        if (!await WaitAsync(StateStore.IsDaemonAlive))
            throw new InvalidOperationException("The resident process didn't start; see audio-capture.log");
    }

    private static void StartDetached()
    {
        var exe = Environment.ProcessPath ?? throw new InvalidOperationException("Unknown executable path");

        Process.Start(new ProcessStartInfo(exe, "run") { UseShellExecute = true, WindowStyle = ProcessWindowStyle.Hidden, CreateNoWindow = true });
    }

    private static async Task<bool> WaitAsync(Func<DaemonState?, bool> done)
    {
        var deadline = DateTime.UtcNow + Patience;

        while (!done(StateStore.Load()) && DateTime.UtcNow < deadline)
        {
            await Task.Delay(250);
        }

        return done(StateStore.Load());
    }
}
