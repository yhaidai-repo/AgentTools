namespace PowerLoom.Infrastructure.ChatLaunch.Models;

// The chat app chosen in Settings → AI providers, as its global `config` row stores it: {"launcher": "<id>"}.
public sealed class ChatAppSetting
{
    public string Launcher { get; set; } = "";
}
