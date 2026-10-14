namespace PowerLoom.AudioCapture.Models;

// Which microphone and which output's loopback a session records; parts of friendly names, empty = default communications device.
public sealed record CaptureSelection(string MicDevice, string SystemDevice)
{
    public static CaptureSelection None { get; } = new("", "");

    public static CaptureSelection From(ToolSettings settings) => new(settings.MicDevice, settings.SystemDevice);
}
