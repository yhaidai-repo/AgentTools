namespace PowerLoom.AudioCapture.Control;

// The CLI talks to the resident `run` process through files in <home>/control (no ports, no pipes to secure).
public static class ControlFiles
{
    public static string Root => Path.Combine(AppPaths.Home, "control");

    public static string StartRequest => Path.Combine(Root, "start.json");

    public static string StopRequest => Path.Combine(Root, "stop");

    public static string QuitRequest => Path.Combine(Root, "quit");

    public static string State => Path.Combine(Root, "state.json");

    public static void Touch(string path)
    {
        Directory.CreateDirectory(Root);
        File.WriteAllText(path, "");
    }

    public static bool TakeRequest(string path)
    {
        if (!File.Exists(path))
            return false;

        File.Delete(path);

        return true;
    }
}
