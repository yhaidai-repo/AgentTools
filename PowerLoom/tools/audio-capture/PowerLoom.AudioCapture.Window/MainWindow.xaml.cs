using System.Collections.Specialized;
using System.ComponentModel;
using System.Windows;
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
        viewModel.ConversationGrew += () => Conversation.ScrollToEnd();
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

    private void OnSpeakerLostFocus(object sender, RoutedEventArgs e) => CommitSpeaker(sender);

    private void OnSpeakerRemove(object sender, RoutedEventArgs e)
    {
        if (sender is Button { DataContext: SpeakerViewModel speaker })
            _viewModel.RemoveSpeaker(speaker);
    }

    // Right-click on a bubble: the session's voices to move it to, or a new name.
    private void OnBubbleMenuOpening(object sender, ContextMenuEventArgs e)
    {
        if (sender is not Border { DataContext: BubbleViewModel bubble } border || bubble.IsMe)
        {
            e.Handled = true;

            return;
        }

        var menu = new ContextMenu();

        foreach (var speaker in _viewModel.Speakers.Where(s => s.Label != bubble.Speaker))
        {
            menu.Items.Add(MoveItem(bubble, speaker.Label));
        }

        menu.Items.Add(new Separator());
        menu.Items.Add(NewNameItem(bubble));
        border.ContextMenu = menu;
    }

    private MenuItem MoveItem(BubbleViewModel bubble, string label)
    {
        var item = new MenuItem { Header = $"Move to {label}" };

        item.Click += (_, _) => _viewModel.ReassignBubble(bubble, label);

        return item;
    }

    private MenuItem NewNameItem(BubbleViewModel bubble)
    {
        var item = new MenuItem { Header = "Move to a new name…" };

        item.Click += (_, _) => AskNewName(bubble);

        return item;
    }

    private void AskNewName(BubbleViewModel bubble)
    {
        var name = Microsoft.VisualBasic.Interaction.InputBox("Whose words are these?", "Move bubble", "");

        if (name.Trim().Length > 0)
            _viewModel.ReassignBubble(bubble, name);
    }

    private void CommitSpeaker(object sender)
    {
        if (sender is TextBox { DataContext: SpeakerViewModel speaker })
            _viewModel.CommitSpeakerName(speaker);
    }
}
