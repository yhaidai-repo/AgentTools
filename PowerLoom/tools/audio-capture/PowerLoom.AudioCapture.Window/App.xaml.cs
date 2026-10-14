using System.Windows;
using PowerLoom.AudioCapture.Control;
using PowerLoom.AudioCapture.Models;
using PowerLoom.AudioCapture.Settings;

namespace PowerLoom.AudioCapture.Ui;

public partial class App : Application
{
    private ResidentHost? _host;

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        if (LoadSettings() is not { } settings)
            return;

        if (HandedToRunningInstance(e.Args))
            return;

        ThemeLoader.Apply(this, settings.Theme);
        _host = new ResidentHost(settings);
        _host.Start(startHidden: e.Args.Contains("--tray"));
    }

    protected override void OnExit(ExitEventArgs e)
    {
        _host?.Dispose();
        base.OnExit(e);
    }

    // A resident instance already runs (tray): opening the exe again shows its window instead of a second process.
    private bool HandedToRunningInstance(string[] args)
    {
        if (!StateStore.IsDaemonAlive(StateStore.Load()))
            return false;

        if (!args.Contains("--tray"))
            DaemonClient.RequestShow();

        Shutdown(0);

        return true;
    }

    private ToolSettings? LoadSettings()
    {
        try
        {
            return SettingsStore.Load();
        }
        catch (InvalidOperationException exception)
        {
            MessageBox.Show(exception.Message, "PowerLoom audio capture", MessageBoxButton.OK, MessageBoxImage.Warning);
            Shutdown(1);

            return null;
        }
    }
}
