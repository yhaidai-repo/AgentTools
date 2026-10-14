using System.Text.Json;
using PowerLoom.AudioCapture.Control;
using PowerLoom.AudioCapture.Models;
using PowerLoom.AudioCapture.Pipeline;
using PowerLoom.AudioCapture.Recording;

namespace PowerLoom.AudioCapture.Daemon;

// The resident process (`run`): one recording at a time, started and stopped by the hotkey or the CLI's control files;
// a stopped recording is transcribed and handed to PowerLoom's inbox in the background.
public sealed class RecorderDaemon(ToolSettings settings)
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromMilliseconds(500);
    private readonly DateTimeOffset _startedAt = DateTimeOffset.Now;
    private readonly MeetingPipeline _pipeline = new(settings);
    private ActiveRecording? _active;
    private string? _lastResult;
    private int _togglesPending;

    public async Task RunAsync(CancellationToken cancellation)
    {
        using var single = new Mutex(true, "PowerLoom.AudioCapture.run", out var first);

        if (!first)
        {
            Log.Info("Another `run` is active; exiting");

            return;
        }

        using var hotkey = GlobalHotkey.Register(settings.Hotkey, () => Interlocked.Increment(ref _togglesPending));

        Log.Info($"Resident process started (pid {Environment.ProcessId}, hotkey {settings.Hotkey}, inbox {settings.InboxPath})");
        PublishState();

        await LoopAsync(cancellation);
        await ShutdownAsync();
    }

    private async Task LoopAsync(CancellationToken cancellation)
    {
        var quit = false;

        while (!quit && !cancellation.IsCancellationRequested)
        {
            quit = await PollAsync();
            await Task.Delay(PollInterval, CancellationToken.None);
        }
    }

    // One tick: a hotkey press toggles; the control files start, stop or quit. Returns true on quit.
    private async Task<bool> PollAsync()
    {
        if (Interlocked.Exchange(ref _togglesPending, 0) > 0)
            await ToggleAsync();

        if (File.Exists(ControlFiles.StartRequest))
            await StartAsync(ReadStartRequest().Title);

        if (ControlFiles.TakeRequest(ControlFiles.StopRequest))
            await StopAsync();

        return ControlFiles.TakeRequest(ControlFiles.QuitRequest);
    }

    private Task ToggleAsync() => _active is null ? StartAsync(null) : StopAsync();

    private Task StartAsync(string? requestedTitle)
    {
        if (_active is not null)
        {
            Log.Info("Start ignored: a recording is running");

            return Task.CompletedTask;
        }

        var title = requestedTitle ?? TeamsWindows.MeetingTitle() ?? "meeting";

        _active = ActiveRecording.Start(title);
        Log.Info($"Recording '{title}' into {_active.Folder}");
        PublishState();

        return Task.CompletedTask;
    }

    private async Task StopAsync()
    {
        if (_active is null)
        {
            Log.Info("Stop ignored: nothing is recording");

            return;
        }

        var (session, title) = _active.Stop();

        _active = null;
        Log.Info($"Stopped '{title}' after {session.DurationSeconds:F0} s; transcribing");
        PublishState();

        await CompleteAsync(session, title);
    }

    private async Task CompleteAsync(RecordingSession session, string title)
    {
        try
        {
            var inboxFile = await _pipeline.CompleteAsync(session, title);

            _lastResult = $"{title}: {Path.GetFileName(inboxFile)}";
            Log.Info($"Handed over: {inboxFile}");
        }
        catch (Exception exception)
        {
            _lastResult = $"{title}: failed ({exception.Message})";
            Log.Error($"Transcription of {session.Folder} failed", exception);
        }

        PublishState();
    }

    private async Task ShutdownAsync()
    {
        if (_active is not null)
            await StopAsync();

        StateStore.Clear();
        Log.Info("Resident process stopped");
    }

    private static StartRequest ReadStartRequest()
    {
        var content = File.ReadAllText(ControlFiles.StartRequest);

        File.Delete(ControlFiles.StartRequest);

        return JsonSerializer.Deserialize<StartRequest>(content) ?? new StartRequest(null);
    }

    private void PublishState() =>
        StateStore.Save(new DaemonState(Environment.ProcessId, _startedAt, _active?.Folder, _active?.Title, _active?.StartedAt, _lastResult));
}
