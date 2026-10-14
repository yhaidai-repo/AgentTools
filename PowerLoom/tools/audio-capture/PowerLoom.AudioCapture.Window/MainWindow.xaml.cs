using System.Collections.Specialized;
using System.ComponentModel;
using System.Windows.Controls;
using System.Windows.Input;

namespace PowerLoom.AudioCapture.Ui;

public partial class MainWindow
{
    private readonly MainViewModel _viewModel;

    public MainWindow(MainViewModel viewModel)
    {
        InitializeComponent();

        _viewModel = viewModel;
        DataContext = viewModel;
        viewModel.Bubbles.CollectionChanged += OnBubblesChanged;
    }

    // Closing hides: the process stays resident for the hotkey and the CLI; Quit is in the tray menu.
    protected override void OnClosing(CancelEventArgs e)
    {
        e.Cancel = true;
        Hide();
    }

    private void OnBubblesChanged(object? sender, NotifyCollectionChangedEventArgs e)
    {
        if (e.Action == NotifyCollectionChangedAction.Add)
            Conversation.ScrollToEnd();
    }

    private void OnSpeakerKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter)
            CommitSpeaker(sender);
    }

    private void OnSpeakerLostFocus(object sender, System.Windows.RoutedEventArgs e) => CommitSpeaker(sender);

    private void CommitSpeaker(object sender)
    {
        if (sender is TextBox { DataContext: SpeakerViewModel speaker })
            _viewModel.CommitSpeakerName(speaker);
    }
}
