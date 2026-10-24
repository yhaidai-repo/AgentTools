namespace PowerLoom.Infrastructure.ChatLaunch;

public static class ChatLaunchSetup
{
    public static WebApplicationBuilder AddPowerLoomChatLaunch(this WebApplicationBuilder builder)
    {
        builder.Services.AddOptions<ChatOptions>().BindConfiguration(ChatOptions.Section);
        builder.Services.AddSingleton<IChatLauncher, ClaudeDesktopLauncher>();
        builder.Services.AddScoped<ChatLaunchers>();
        builder.Services.AddSingleton<HostPaths>();

        return builder;
    }
}
