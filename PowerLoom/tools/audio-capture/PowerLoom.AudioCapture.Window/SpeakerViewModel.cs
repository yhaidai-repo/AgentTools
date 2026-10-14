using System.ComponentModel;

namespace PowerLoom.AudioCapture.Ui;

// One voice of the shown session: the editable label and what it was called when loaded.
public sealed class SpeakerViewModel(string label, double seconds, bool known) : INotifyPropertyChanged
{
    private string _label = label;

    public event PropertyChangedEventHandler? PropertyChanged;

    public string OriginalLabel { get; private set; } = label;

    // After a live rename the current label is the one later renames start from.
    public void Renamed() => OriginalLabel = Label.Trim();

    public string Detail { get; } = $"{seconds:F0} s{(known ? ", known voice" : "")}";

    public string Label
    {
        get => _label;
        set
        {
            _label = value;
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(Label)));
        }
    }
}
