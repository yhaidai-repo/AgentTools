using System.Diagnostics;
using System.Text.Json;
using PowerLoom.AudioCapture.Models;

namespace PowerLoom.AudioCapture.Control;

public static class StateStore
{
    private static readonly JsonSerializerOptions Json = new() { WriteIndented = true };

    public static DaemonState? Load()
    {
        if (!File.Exists(ControlFiles.State))
            return null;

        return JsonSerializer.Deserialize<DaemonState>(File.ReadAllText(ControlFiles.State), Json);
    }

    public static void Save(DaemonState state)
    {
        Directory.CreateDirectory(ControlFiles.Root);
        File.WriteAllText(ControlFiles.State, JsonSerializer.Serialize(state, Json));
    }

    public static void Clear()
    {
        if (File.Exists(ControlFiles.State))
            File.Delete(ControlFiles.State);
    }

    // A state file outlives a crashed process: it counts only while its pid is alive.
    public static bool IsDaemonAlive(DaemonState? state)
    {
        if (state is null)
            return false;

        try
        {
            return !Process.GetProcessById(state.Pid).HasExited;
        }
        catch (ArgumentException)
        {
            return false;
        }
    }
}
