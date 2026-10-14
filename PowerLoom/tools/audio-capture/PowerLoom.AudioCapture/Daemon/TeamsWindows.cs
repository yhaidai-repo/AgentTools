using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

namespace PowerLoom.AudioCapture.Daemon;

// The meeting's name from a Teams window title: "Weekly sync | Microsoft Teams" → "Weekly sync". The main window's
// titles start with the page ("Chat | Anna … | Microsoft Teams", "Calendar | Microsoft Teams") and are skipped.
public static class TeamsWindows
{
    private const string Separator = " | ";
    private static readonly string[] ProcessNames = ["ms-teams", "Teams"];
    private static readonly HashSet<string> MainWindowNames = new(StringComparer.OrdinalIgnoreCase)
        { "Microsoft Teams", "Chat", "Activity", "Teams", "Calendar", "Calls", "Files", "Apps", "OneDrive", "Communities" };

    public static string? MeetingTitle() => Titles().Select(FirstSegment).FirstOrDefault(IsMeetingName);

    public static List<string> Titles()
    {
        var pids = ProcessNames.SelectMany(Process.GetProcessesByName).Select(p => (uint)p.Id).ToHashSet();
        var titles = new List<string>();

        if (pids.Count == 0)
            return titles;

        EnumWindows((window, _) => Collect(window, pids, titles), IntPtr.Zero);

        return titles;
    }

    private static bool Collect(IntPtr window, HashSet<uint> pids, List<string> titles)
    {
        GetWindowThreadProcessId(window, out var pid);

        if (!pids.Contains(pid) || !IsWindowVisible(window))
            return true;

        var title = TitleOf(window);

        if (title.Length > 0)
            titles.Add(title);

        return true;
    }

    private static string TitleOf(IntPtr window)
    {
        var buffer = new StringBuilder(512);

        GetWindowText(window, buffer, buffer.Capacity);

        return buffer.ToString().Trim();
    }

    private static string FirstSegment(string title) => title.Split(Separator)[0].Trim();

    private static bool IsMeetingName(string name) => name.Length > 0 && !MainWindowNames.Contains(name);

    private delegate bool EnumWindowsProc(IntPtr window, IntPtr parameter);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr parameter);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool IsWindowVisible(IntPtr window);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr window, StringBuilder text, int maxLength);
}
