using System.Windows;
using System.Windows.Threading;
using PowerLoom.AudioCapture.Daemon;
using PowerLoom.AudioCapture.Models;

namespace PowerLoom.AudioCapture.Ui;

// Wires the RecorderDaemon (its loop on a background task) to the window, the view model and the tray icon.
// Daemon events arrive on other threads and are marshalled to the dispatcher here.
public sealed class ResidentHost : IDisposable
{
    private readonly RecorderDaemon _daemon;
    private readonly MainViewModel _viewModel;
    private readonly MainWindow _window;
    private readonly TrayIcon _tray;
    private readonly CancellationTokenSource _stopping = new();
    private readonly Dispatcher _dispatcher = Application.Current.Dispatcher;

    public ResidentHost(ToolSettings settings)
    {
        _daemon = new RecorderDaemon(settings);
        _viewModel = new MainViewModel(settings, _daemon);
        _window = new MainWindow(_viewModel);
        _tray = new TrayIcon(ShowWindow, _daemon.RequestToggle, _daemon.RequestQuit);

        _daemon.RecordingStarted += recording => OnUi(() => OnRecordingStarted(recording));
        _daemon.RecordingStopped += (session, title) => OnUi(() => OnRecordingStopped(session, title));
        _daemon.TranscriptReady += (result, inbox) => OnUi(() => _viewModel.OnTranscriptReady(result, inbox));
        _daemon.Failed += message => OnUi(() => _viewModel.OnFailed(message));
        _daemon.Level += (channel, level) => OnUi(() => _viewModel.OnLevel(channel, level));
        _daemon.ShowRequested += () => OnUi(ShowWindow);
        _daemon.LiveSegment += segment => OnUi(() => _viewModel.OnLiveSegment(segment));
    }

    public void Start(bool startHidden)
    {
        _viewModel.ShowLatestSession();

        if (!startHidden)
            ShowWindow();

        _ = RunDaemonAsync();
    }

    public void Dispose()
    {
        _stopping.Cancel();
        _tray.Dispose();
    }

    private async Task RunDaemonAsync()
    {
        await Task.Run(() => _daemon.RunAsync(_stopping.Token));

        // The loop ended: quit requested (CLI, tray) or another resident process holds the mutex.
        OnUi(() => Application.Current.Shutdown());
    }

    private void ShowWindow()
    {
        _window.Show();

        if (_window.WindowState == WindowState.Minimized)
            _window.WindowState = WindowState.Normal;

        _window.Activate();
    }

    private void OnRecordingStarted(ActiveRecording recording)
    {
        _viewModel.OnRecordingStarted(recording);
        _tray.SetRecording(true);
        _tray.Notify("Recording", recording.Title);
    }

    private void OnRecordingStopped(RecordingSession session, string title)
    {
        _viewModel.OnRecordingStopped(session, title);
        _tray.SetRecording(false);
        _tray.Notify("Stopped", $"{title}: transcribing");
    }

    private void OnUi(Action action) => _dispatcher.BeginInvoke(action);
}
