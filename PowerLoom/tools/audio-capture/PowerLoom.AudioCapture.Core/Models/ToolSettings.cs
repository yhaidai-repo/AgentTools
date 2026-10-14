namespace PowerLoom.AudioCapture.Models;

// settings.json in the tool's home, written by `install`.
public sealed record ToolSettings(
    string InboxPath,
    string Model = "large-v3-turbo",
    string Hotkey = "Ctrl+Alt+F9",
    string PromptFile = "prompt.txt",
    // Part of a device's friendly name (`devices` lists them); empty = the default communications device.
    string MicDevice = "",
    string SystemDevice = "",
    // Languages expected in meetings (ISO codes, comma-separated); a segment detected as another one is noise. Empty = any.
    string Languages = "uk,ru,en",
    // Window colours: dark, light, or system (Windows' app mode).
    string Theme = "system");
