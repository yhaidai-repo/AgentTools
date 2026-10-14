using System.Collections.Specialized;
using System.ComponentModel;

namespace PowerLoom.AudioCapture.Ui;

public partial class MainWindow
{
    public MainWindow(MainViewModel viewModel)
    {
        InitializeComponent();

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
}
