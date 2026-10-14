using System.Text.Json;
using PowerLoom.AudioCapture.Control;
using PowerLoom.AudioCapture.Models;
using PowerLoom.AudioCapture.Pipeline;

namespace PowerLoom.AudioCapture.Daemon;

// The resident process's core: one recording at a time, started and stopped by the hotkey, the window or the CLI's
// control files; live segments while it runs, then the final pass and the hand-over to PowerLoom's inbox. All state
// changes happen on the loop; callers only post requests. Hosts observe through the events (raised on other threads).
public sealed class RecorderDaemon(ToolSettings settings)
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromMilliseconds(500);
    private readonly DateTimeOffset _startedAt = DateTimeOffset.Now;
    private readonly MeetingPipeline _pipeline = new(settings);
    private ActiveRecording? _active;
    private string? _lastResult;
    private int _togglesPending;
    private string? _pendingStartTitle;
    private int _startPending;
    private int _stopPending;
    private int _quitPending;

    public event Action<ActiveRecording>? RecordingStarted;

    public event Action<RecordingSession, string>? RecordingStopped;

    public event Action<TranscriptSegment>? LiveSegment;

    public event Action<TranscriptResult, string>? TranscriptReady;

    public event Action<string>? Failed;

    public event Action<string, float>? Level;

    public event Action? ShowRequested;

    public bool IsRecording => _active is not null;

    public ActiveRecording? Active => _active;

    public void RequestToggle() => Interlocked.Increment(ref _togglesPending);

    public void RequestStart(string? title)
    {
        _pendingStartTitle = title;
        Interlocked.Exchange(ref _startPending, 1);
    }

    public void RequestStop() => Interlocked.Exchange(ref _stopPending, 1);

    public void RequestQuit() => Interlocked.Exchange(ref _quitPending, 1);

    public async Task RunAsync(CancellationToken cancellation)
    {
        using var single = new Mutex(true, "PowerLoom.AudioCapture.run", out var first);

        if (!first)
        {
            Log.Info("Another resident process is active; exiting");

            return;
        }

        using var hotkey = GlobalHotkey.Register(settings.Hotkey, RequestToggle);

        Log.Info($"Resident process started (pid {Environment.ProcessId}, hotkey {settings.Hotkey}, inbox {settings.InboxPath})");
        PublishState();
        WarmUpEngine();

        await LoopAsync(cancellation);
        await ShutdownAsync();
    }

    // The model loads in the background so the first recording streams at once; a failure shows up on the first use.
    private void WarmUpEngine() => _ = _pipeline.EngineAsync().ContinueWith(
        task => Log.Error("Model load failed", task.Exception!.GetBaseException()), TaskContinuationOptions.OnlyOnFaulted);

    private async Task LoopAsync(CancellationToken cancellation)
    {
        var quit = false;

        while (!quit && !cancellation.IsCancellationRequested)
        {
            quit = await PollAsync();
            await Task.Delay(PollInterval, CancellationToken.None);
        }
    }

    // One tick: in-process requests first, then the CLI's control files. Returns true on quit.
    private async Task<bool> PollAsync()
    {
        if (Interlocked.Exchange(ref _togglesPending, 0) > 0)
            await ToggleAsync();

        if (Interlocked.Exchange(ref _startPending, 0) == 1)
            await StartAsync(_pendingStartTitle);

        if (File.Exists(ControlFiles.StartRequest))
            await StartAsync(ReadStartRequest().Title);

        if (Interlocked.Exchange(ref _stopPending, 0) == 1 || ControlFiles.TakeRequest(ControlFiles.StopRequest))
            await StopAsync();

        if (ControlFiles.TakeRequest(ControlFiles.ShowRequest))
            ShowRequested?.Invoke();

        return Interlocked.Exchange(ref _quitPending, 0) == 1 || ControlFiles.TakeRequest(ControlFiles.QuitRequest);
    }

    private Task ToggleAsync() => _active is null ? StartAsync(null) : StopAsync();

    private async Task StartAsync(string? requestedTitle)
    {
        if (_active is not null)
        {
            Log.Info("Start ignored: a recording is running");

            return;
        }

        var title = requestedTitle ?? TeamsWindows.MeetingTitle() ?? "meeting";
        var engine = await _pipeline.EngineAsync();

        _active = ActiveRecording.Start(title, CaptureSelection.From(settings), engine, (channel, level) => Level?.Invoke(channel, level));
        _active.LiveSegment += segment => LiveSegment?.Invoke(segment);
        Log.Info($"Recording '{title}' into {_active.Folder}");
        PublishState();
        RecordingStarted?.Invoke(_active);
    }

    private async Task StopAsync()
    {
        if (_active is null)
        {
            Log.Info("Stop ignored: nothing is recording");

            return;
        }

        var recording = _active;
        var session = await recording.StopAsync();

        _active = null;
        Log.Info($"Stopped '{recording.Title}' after {session.DurationSeconds:F0} s; transcribing");
        PublishState();
        RecordingStopped?.Invoke(session, recording.Title);

        await CompleteAsync(session, recording.Title);
    }

    private async Task CompleteAsync(RecordingSession session, string title)
    {
        try
        {
            var (result, inboxFile) = await _pipeline.CompleteAsync(session);

            _lastResult = $"{title}: {Path.GetFileName(inboxFile)}";
            Log.Info($"Handed over: {inboxFile}");
            TranscriptReady?.Invoke(result, inboxFile);
        }
        catch (Exception exception)
        {
            _lastResult = $"{title}: failed ({exception.Message})";
            Log.Error($"Transcription of {session.Folder} failed", exception);
            Failed?.Invoke(_lastResult);
        }

        PublishState();
    }

    private async Task ShutdownAsync()
    {
        if (_active is not null)
            await StopAsync();

        _pipeline.Dispose();
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
