using NAudio.CoreAudioApi;
using NAudio.Wave;

namespace PowerLoom.AudioCapture.Recording;

// The two WASAPI recorders of a session: the default microphone and the default output's loopback.
public static class CaptureDevices
{
    // Communications mode turns on Windows' voice processing for the mic (echo cancellation against the default output,
    // noise suppression), so the other side's voices stay out of the mic channel. Pinning another reference output
    // (WithEchoCancellationReferenceEndpoint) is refused by the Realtek USB driver at start, so it isn't used.
    public static WasapiRecorder Microphone(bool echoCancellation)
    {
        var builder = new WasapiRecorderBuilder().WithDevice(Default(DataFlow.Capture)).WithSharedMode();

        if (echoCancellation)
            builder = builder.WithCommunicationsMode();

        return builder.Build();
    }

    public static WasapiRecorder SystemLoopback() =>
        new WasapiRecorderBuilder().WithDevice(Default(DataFlow.Render)).WithLoopbackCapture().Build();

    private static MMDevice Default(DataFlow flow)
    {
        using var devices = new MMDeviceEnumerator();

        return devices.GetDefaultAudioEndpoint(flow, Role.Communications);
    }
}
