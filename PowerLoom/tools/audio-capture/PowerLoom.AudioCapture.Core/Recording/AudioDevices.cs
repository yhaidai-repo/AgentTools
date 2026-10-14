using NAudio.CoreAudioApi;

namespace PowerLoom.AudioCapture.Recording;

// `devices`: every active microphone and output with its default roles, to pick names for the settings.
public static class AudioDevices
{
    public static List<string> Describe()
    {
        using var devices = new MMDeviceEnumerator();

        var lines = new List<string> { "Microphones (capture):" };

        lines.AddRange(Lines(devices, DataFlow.Capture));
        lines.Add("Outputs (render; the system channel is their loopback):");
        lines.AddRange(Lines(devices, DataFlow.Render));

        return lines;
    }

    private static IEnumerable<string> Lines(MMDeviceEnumerator devices, DataFlow flow)
    {
        var multimedia = devices.GetDefaultAudioEndpoint(flow, Role.Multimedia).ID;
        var communications = devices.GetDefaultAudioEndpoint(flow, Role.Communications).ID;

        return devices.EnumerateAudioEndPoints(flow, DeviceState.Active)
            .Select(device => $"  {device.FriendlyName}{Marks(device.ID, multimedia, communications)}");
    }

    private static string Marks(string id, string multimedia, string communications)
    {
        var marks = new List<string>();

        if (id == multimedia)
            marks.Add("default");

        if (id == communications)
            marks.Add("communications (used when the settings name none)");

        return marks.Count == 0 ? "" : $"  [{string.Join(", ", marks)}]";
    }
}
