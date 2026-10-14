namespace PowerLoom.AudioCapture;

// The tool's own data on the PC, outside the repo: recordings and models.
public static class AppPaths
{
    public static string Home { get; } = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "PowerLoom", "audio-capture");
}
