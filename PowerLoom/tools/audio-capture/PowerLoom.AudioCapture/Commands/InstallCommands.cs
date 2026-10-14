using PowerLoom.AudioCapture.Control;
using PowerLoom.AudioCapture.Install;
using PowerLoom.AudioCapture.Models;
using PowerLoom.AudioCapture.Settings;

namespace PowerLoom.AudioCapture.Commands;

// `install --inbox <path> [--home <path>] [--model] [--hotkey]` writes settings.json and the logon task;
// `uninstall` removes the task and stops the resident process.
public static class InstallCommands
{
    public static async Task<int> InstallAsync(CommandOptions options)
    {
        var inbox = options.Value("--inbox") ?? throw new ArgumentException("install needs --inbox <PowerLoom import-inbox/meetings folder>");

        PinHome(options.Value("--home"));

        var current = File.Exists(SettingsStore.FilePath) ? SettingsStore.Load() : new ToolSettings(inbox);
        var settings = current with
        {
            InboxPath = Path.GetFullPath(inbox),
            Model = options.Value("--model") ?? current.Model,
            Hotkey = options.Value("--hotkey") ?? current.Hotkey,
            MicDevice = options.Value("--mic") ?? current.MicDevice,
            SystemDevice = options.Value("--system") ?? current.SystemDevice,
            Languages = options.Value("--languages") ?? current.Languages,
            Theme = options.Value("--theme") ?? current.Theme,
        };

        SettingsStore.Save(settings);
        await DaemonClient.RequestQuitAsync();
        TaskSchedulerInstaller.Install();

        Console.WriteLine($"Installed: home {AppPaths.Home}, settings {SettingsStore.FilePath}, prompt {SettingsStore.PromptPath(settings)}, task '{TaskSchedulerInstaller.TaskName}' started (hotkey {settings.Hotkey})");

        return 0;
    }

    public static async Task<int> UninstallAsync()
    {
        await DaemonClient.RequestQuitAsync();
        TaskSchedulerInstaller.Uninstall();

        Console.WriteLine($"Removed the task '{TaskSchedulerInstaller.TaskName}'; settings, models and recordings stay in {AppPaths.Home}");

        return 0;
    }

    private static void PinHome(string? home)
    {
        if (home is not null)
            AppPaths.PinHome(home);
    }
}
