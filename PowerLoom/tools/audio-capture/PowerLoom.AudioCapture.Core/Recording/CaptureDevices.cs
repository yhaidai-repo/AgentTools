using NAudio.CoreAudioApi;
using NAudio.Wave;

namespace PowerLoom.AudioCapture.Recording;

// The two WASAPI recorders of a session. A device is chosen by a part of its friendly name from the settings
// ("AirPods"); empty = the default communications device, the one Teams uses unless told otherwise.
public static class CaptureDevices
{
    // Communications mode turns on Windows' voice processing for the mic (echo cancellation against the default output,
    // noise suppression), so the other side's voices stay out of the mic channel. Pinning another reference output
    // (WithEchoCancellationReferenceEndpoint) is refused by the Realtek USB driver at start, so it isn't used.
    public static WasapiRecorder Microphone(string preferredName, bool echoCancellation)
    {
        var builder = new WasapiRecorderBuilder().WithDevice(Choose(DataFlow.Capture, preferredName)).WithSharedMode();

        if (echoCancellation)
            builder = builder.WithCommunicationsMode();

        return builder.Build();
    }

    public static WasapiRecorder SystemLoopback(MMDevice output) =>
        new WasapiRecorderBuilder().WithDevice(output).WithLoopbackCapture().Build();

    public static MMDevice Choose(DataFlow flow, string preferredName)
    {
        using var devices = new MMDeviceEnumerator();

        return Named(devices, flow, preferredName) ?? devices.GetDefaultAudioEndpoint(flow, Role.Communications);
    }

    private static MMDevice? Named(MMDeviceEnumerator devices, DataFlow flow, string preferredName)
    {
        if (preferredName.Trim().Length == 0)
            return null;

        return devices.EnumerateAudioEndPoints(flow, DeviceState.Active)
            .FirstOrDefault(device => device.FriendlyName.Contains(preferredName.Trim(), StringComparison.OrdinalIgnoreCase));
    }
}
