namespace PowerLoom.AudioCapture;

// One line per event in audio-capture.log (and on the console), like the Outlook exporter's export.log.
public static class Log
{
    private static string FilePath => Path.Combine(AppPaths.Home, "audio-capture.log");
    private static readonly Lock Sync = new();

    public static void Info(string message)
    {
        Console.WriteLine(message);
        Append($"{DateTime.Now:yyyy-MM-dd HH:mm:ss} {message}");
    }

    public static void Error(string message, Exception exception) => Info($"{message}: {exception.GetType().Name}: {exception.Message}");

    private static void Append(string line)
    {
        lock (Sync)
        {
            Directory.CreateDirectory(AppPaths.Home);
            File.AppendAllText(FilePath, line + Environment.NewLine);
        }
    }
}
