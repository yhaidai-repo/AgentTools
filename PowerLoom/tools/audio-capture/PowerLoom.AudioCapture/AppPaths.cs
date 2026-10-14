namespace PowerLoom.AudioCapture;

// The tool's own data on the PC, outside the repo: settings, prompt, models, recordings, control files, log.
// Default %LOCALAPPDATA%\PowerLoom\audio-capture; `install --home <path>` pins another folder in home.txt beside the exe
// (needed when the installing shell's profile writes are virtualized, as in the Claude desktop app's sandbox).
public static class AppPaths
{
    public static string PointerFile { get; } = Path.Combine(AppContext.BaseDirectory, "home.txt");

    public static string DefaultHome { get; } = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "PowerLoom", "audio-capture");

    public static string Home { get; private set; } = ReadPointer() ?? DefaultHome;

    public static void PinHome(string home)
    {
        Home = Path.GetFullPath(home);
        File.WriteAllText(PointerFile, Home);
    }

    private static string? ReadPointer()
    {
        if (!File.Exists(PointerFile))
            return null;

        var home = File.ReadAllText(PointerFile).Trim();

        return home.Length > 0 ? home : null;
    }
}
