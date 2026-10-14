namespace PowerLoom.AudioCapture.Models;

// settings.json in the tool's home, written by `install`.
public sealed record ToolSettings(
    string InboxPath,
    string Model = "large-v3-turbo",
    string Hotkey = "Ctrl+Alt+F9",
    string PromptFile = "prompt.txt");
