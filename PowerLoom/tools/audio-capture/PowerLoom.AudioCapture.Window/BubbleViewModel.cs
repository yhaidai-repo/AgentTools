using System.ComponentModel;
using PowerLoom.AudioCapture.Models;
using PowerLoom.AudioCapture.Recording;

namespace PowerLoom.AudioCapture.Ui;

// One turn of the conversation as the window shows it; a provisional one grows while the live view adds segments.
public sealed class BubbleViewModel : INotifyPropertyChanged
{
    private string _text;

    private BubbleViewModel(string speaker, TimeSpan start, string text, bool isProvisional)
    {
        Speaker = speaker;
        Time = start.ToString(@"hh\:mm\:ss");
        IsMe = speaker == SessionRecorder.MicChannel;
        IsProvisional = isProvisional;
        _text = text;
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    public string Speaker { get; }

    public string Time { get; }

    public bool IsMe { get; }

    public bool IsProvisional { get; }

    public string Text
    {
        get => _text;
        private set
        {
            _text = value;
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(Text)));
        }
    }

    public static BubbleViewModel Final(TranscriptTurn turn) => new(turn.Speaker, turn.Start, turn.Text, isProvisional: false);

    public static BubbleViewModel Provisional(TranscriptSegment segment) => new(segment.Speaker, segment.Start, segment.Text, isProvisional: true);

    public void Append(string text) => Text = Text + " " + text;
}
