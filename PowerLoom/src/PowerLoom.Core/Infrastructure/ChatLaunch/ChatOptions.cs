namespace PowerLoom.Infrastructure.ChatLaunch;

// PC paths a "continue with <agent>" chat needs: the chat runs on the PC, not in the containers.
public sealed class ChatOptions
{
    public const string Section = "Chat";

    // The agent app chats open in when Settings → AI providers has no choice saved (CONTINUE_LAUNCHER); one launcher per app.
    public string Launcher { get; set; } = ClaudeDesktopLauncher.LauncherId;

    // The repos folder on the PC: D:/Projects/<repo>.
    public string ReposRoot { get; set; } = "";

    // PowerLoom's backlog vault on the PC, with a folder per vault; chats read its notes by absolute path.
    public string BacklogHostRoot { get; set; } = "";

    // The folder with VaultUsage and VaultCapture on the PC; empty = vaults can't be configured for the app.
    public string AgentTools { get; set; } = "";
}
