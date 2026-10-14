using System.ComponentModel;
using PowerLoom.AudioCapture.Models;
using PowerLoom.AudioCapture.Recording;

namespace PowerLoom.AudioCapture.Ui;

// One turn of the conversation as the window shows it; a provisional one grows while the live view adds segments.
public sealed class BubbleViewModel : INotifyPropertyChanged
{
    private const int MaxLiveChars = 320;
    private string _text;

    private BubbleViewModel(string speaker, string channel, TimeSpan start, string text, bool isProvisional)
    {
        Speaker = speaker;
        Time = start.ToString(@"hh\:mm\:ss");
        IsMe = channel == SessionRecorder.MicChannel;
        IsProvisional = isProvisional;
        _text = text;
        End = start;
    }

    // Where the live text ends so far: a later segment after a pause, or a long bubble, starts a new one.
    public TimeSpan End { get; private set; }

    public bool CanTake(TranscriptSegment segment, TimeSpan maxGap) =>
        IsProvisional && Speaker == segment.Speaker && segment.Start - End <= maxGap && Text.Length < MaxLiveChars;

    public event PropertyChangedEventHandler? PropertyChanged;

    private string _speaker = "";

    public string Speaker
    {
        get => _speaker;
        private set
        {
            _speaker = value;
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(Speaker)));
        }
    }

    public void Relabel(string oldLabel, string name)
    {
        if (Speaker == oldLabel)
            Speaker = name;
    }

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

    public static BubbleViewModel Final(TranscriptTurn turn) => new(turn.Speaker, turn.Channel, turn.Start, turn.Text, isProvisional: false);

    public static BubbleViewModel Provisional(TranscriptSegment segment) =>
        new(segment.Speaker, segment.ChannelOrSpeaker, segment.Start, segment.Text, isProvisional: true) { End = segment.End };

    public void Append(TranscriptSegment segment)
    {
        End = segment.End;
        Text = Text + " " + segment.Text;
    }
}
