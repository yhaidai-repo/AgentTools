using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Runtime.CompilerServices;
using System.Windows.Threading;
using PowerLoom.AudioCapture.Daemon;
using PowerLoom.AudioCapture.Models;
using PowerLoom.AudioCapture.Recording;
using PowerLoom.AudioCapture.Speakers;
using PowerLoom.AudioCapture.Transcription;

namespace PowerLoom.AudioCapture.Ui;

// State of the window: title, recording status and clock, the two level meters, the bubbles of the shown session.
// Every member runs on the dispatcher thread.
public sealed class MainViewModel : INotifyPropertyChanged
{
    private static readonly TimeSpan LevelHold = TimeSpan.FromMilliseconds(250);
    private static readonly TimeSpan LiveBubbleGap = TimeSpan.FromSeconds(2.5);
    private const float SpeakingLevel = 0.12f;

    private readonly RecorderDaemon _daemon;
    private readonly SpeakerRenamer _renamer;
    private readonly DispatcherTimer _clock = new() { Interval = TimeSpan.FromMilliseconds(100) };
    private readonly Dictionary<string, DateTime> _levelSeen = new();
    private string _title = "";
    private bool _isRecording;
    private string _status;
    private string _elapsed = "";
    private double _micLevel;
    private double _systemLevel;
    private string? _sessionFolder;
    private DateTimeOffset _recordingStartedAt;

    public MainViewModel(ToolSettings settings, RecorderDaemon daemon)
    {
        _daemon = daemon;
        _renamer = new SpeakerRenamer(new VoiceStore(new VoiceSpace()), settings);
        _status = $"Idle · hotkey {settings.Hotkey}";
        ToggleCommand = new RelayCommand(Toggle);
        OpenFolderCommand = new RelayCommand(OpenFolder, () => _sessionFolder is not null);
        _clock.Tick += (_, _) => Tick();
        _clock.Start();
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    // Raised on every live addition (new bubble or grown bubble) so the window scrolls to it.
    public event Action? ConversationGrew;

    public ObservableCollection<BubbleViewModel> Bubbles { get; } = [];

    // The voices of the shown session (the others only); editing a label names the voice for this and later meetings.
    public ObservableCollection<SpeakerViewModel> Speakers { get; } = [];

    public RelayCommand ToggleCommand { get; }

    public RelayCommand OpenFolderCommand { get; }

    public string Title { get => _title; set => Set(ref _title, value); }

    public bool IsRecording { get => _isRecording; private set { Set(ref _isRecording, value); Raise(nameof(ToggleText)); } }

    public string ToggleText => IsRecording ? "Stop" : "Start recording";

    public string Status { get => _status; private set => Set(ref _status, value); }

    public string Elapsed { get => _elapsed; private set => Set(ref _elapsed, value); }

    public double MicLevel { get => _micLevel; private set { Set(ref _micLevel, value); Raise(nameof(MicSpeaking)); } }

    public double SystemLevel { get => _systemLevel; private set { Set(ref _systemLevel, value); Raise(nameof(SystemSpeaking)); } }

    public bool MicSpeaking => _micLevel >= SpeakingLevel;

    public bool SystemSpeaking => _systemLevel >= SpeakingLevel;

    public void ShowLatestSession()
    {
        if (SessionHistory.LatestTranscribedFolder() is { } folder)
            ShowSession(folder, SessionHistory.LoadSegments(folder), $"Last: {SessionHistory.TitleOf(folder)}");
    }

    public void OnRecordingStarted(ActiveRecording recording)
    {
        _recordingStartedAt = recording.StartedAt;
        Title = recording.Title;
        Bubbles.Clear();
        Speakers.Clear();
        SetSessionFolder(recording.Folder);
        IsRecording = true;
        Status = $"Recording · {recording.Title}";
    }

    public void OnRecordingStopped(RecordingSession session, string title)
    {
        IsRecording = false;
        Elapsed = "";
        MicLevel = 0;
        SystemLevel = 0;
        Status = $"Saving · {title} ({session.DurationSeconds:F0} s)";
    }

    public void OnTranscriptReady(TranscriptResult result, string inboxFile)
    {
        var folder = Path.GetDirectoryName(result.MarkdownPath)!;

        ShowSession(folder, result.Segments, $"Handed to PowerLoom · {Path.GetFileName(inboxFile)}");
        Title = "";
    }

    // A live segment while recording: provisional text, joined to the previous bubble when the same speaker goes on
    // without a pause; a pause or a long bubble starts a new one, so the view keeps moving.
    public void OnLiveSegment(TranscriptSegment segment)
    {
        var last = Bubbles.LastOrDefault();

        if (last is not null && last.CanTake(segment, LiveBubbleGap))
            last.Append(segment);
        else
            Bubbles.Add(BubbleViewModel.Provisional(segment));

        ConversationGrew?.Invoke();
    }

    public void OnFailed(string message) => Status = message;

    public void OnLevel(string channel, float level)
    {
        _levelSeen[channel] = DateTime.UtcNow;

        if (channel == SessionRecorder.MicChannel)
            MicLevel = level;
        else
            SystemLevel = level;
    }

    private void ShowSession(string folder, IReadOnlyList<TranscriptSegment> segments, string status)
    {
        Bubbles.Clear();

        foreach (var turn in TranscriptTurns.From(segments))
        {
            Bubbles.Add(BubbleViewModel.Final(turn));
        }

        LoadSpeakers(folder);
        SetSessionFolder(folder);
        Status = status;
    }

    private void LoadSpeakers(string folder)
    {
        Speakers.Clear();

        foreach (var speaker in SessionSpeakers.Load(folder))
        {
            Speakers.Add(new SpeakerViewModel(speaker.Label, speaker.Seconds, speaker.Known));
        }
    }

    // Enter or focus loss on a speaker's box. While recording the live voice is renamed in place (bubbles follow, profile
    // stored); otherwise the name goes into the session's files and the voice store, and the session reloads.
    public void CommitSpeakerName(SpeakerViewModel speaker)
    {
        if (IsRecording)
            CommitLiveSpeakerName(speaker);
        else
            CommitStoredSpeakerName(speaker);
    }

    // The live voices: new ones are added, renamed ones update their label; a box being edited is left alone.
    public void OnSpeakersChanged(IReadOnlyList<SpeakerInfo> speakers)
    {
        foreach (var info in speakers)
        {
            var existing = Speakers.FirstOrDefault(s => s.OriginalLabel == info.Label || s.Label == info.Label);

            if (existing is null)
                Speakers.Add(new SpeakerViewModel(info.Label, info.Seconds, info.Known));
        }
    }

    private void CommitLiveSpeakerName(SpeakerViewModel speaker)
    {
        if (!_daemon.RenameLiveSpeaker(speaker.OriginalLabel, speaker.Label))
            return;

        RelabelBubbles(speaker.OriginalLabel, speaker.Label.Trim());
        speaker.Renamed();
        Status = $"Named {speaker.Label}; voice stored";
    }

    private void CommitStoredSpeakerName(SpeakerViewModel speaker)
    {
        if (_sessionFolder is null || !_renamer.Rename(_sessionFolder, speaker.OriginalLabel, speaker.Label))
            return;

        ShowSession(_sessionFolder, SessionHistory.LoadSegments(_sessionFolder), $"Named {speaker.OriginalLabel} as {speaker.Label.Trim()}; voice stored");
    }

    private void RelabelBubbles(string oldLabel, string name)
    {
        foreach (var bubble in Bubbles)
        {
            bubble.Relabel(oldLabel, name);
        }
    }

    private void Toggle()
    {
        if (IsRecording)
            _daemon.RequestStop();
        else
            _daemon.RequestStart(Title.Trim().Length > 0 ? Title.Trim() : null);
    }

    private void OpenFolder()
    {
        if (_sessionFolder is not null)
            Process.Start(new ProcessStartInfo("explorer.exe", _sessionFolder) { UseShellExecute = true });
    }

    private void SetSessionFolder(string folder)
    {
        _sessionFolder = folder;
        OpenFolderCommand.RaiseCanExecuteChanged();
    }

    // The clock while recording, and the meters fall back to zero when a channel goes quiet (no more level events).
    private void Tick()
    {
        if (IsRecording)
            Elapsed = (DateTimeOffset.Now - _recordingStartedAt).ToString(@"hh\:mm\:ss");

        if (IsStale(SessionRecorder.MicChannel) && MicLevel > 0)
            MicLevel = 0;

        if (IsStale(SessionRecorder.SystemChannel) && SystemLevel > 0)
            SystemLevel = 0;
    }

    private bool IsStale(string channel) =>
        !_levelSeen.TryGetValue(channel, out var seen) || DateTime.UtcNow - seen > LevelHold;

    private void Set<T>(ref T field, T value, [CallerMemberName] string? name = null)
    {
        if (EqualityComparer<T>.Default.Equals(field, value))
            return;

        field = value;
        Raise(name);
    }

    private void Raise(string? name) => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}
