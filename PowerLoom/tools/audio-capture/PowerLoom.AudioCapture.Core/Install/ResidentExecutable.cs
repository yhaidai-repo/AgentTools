namespace PowerLoom.AudioCapture.Install;

// Which executable is the resident process: the window app beside this one (tray icon, conversation view) when it is
// built, else this CLI's `run`. Both executables build into the same folder.
public static class ResidentExecutable
{
    public const string WindowFileName = "PowerLoom.AudioCapture.Window.exe";

    public static (string Path, string Arguments) Resolve()
    {
        var current = Environment.ProcessPath ?? throw new InvalidOperationException("Unknown executable path");

        if (System.IO.Path.GetFileName(current).Equals(WindowFileName, StringComparison.OrdinalIgnoreCase))
            return (current, "--tray");

        var window = System.IO.Path.Combine(AppContext.BaseDirectory, WindowFileName);

        return File.Exists(window) ? (window, "--tray") : (current, "run");
    }
}
