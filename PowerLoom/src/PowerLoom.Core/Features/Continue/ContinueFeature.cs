using PowerLoom.Features.Continue.Targets;

namespace PowerLoom.Features.Continue;

public static class ContinueFeature
{
    public static IServiceCollection AddContinueFeature(this IServiceCollection services)
    {
        services.AddScoped<ChatOpener>();
        services.AddScoped<ChatAppChoices>();
        services.AddScoped<PbiRepos>();
        services.AddScoped<IChatTarget, VaultSetupChatTarget>();
        services.AddScoped<IChatTarget, VaultImportChatTarget>();
        services.AddScoped<IChatTarget, ItemChatTarget>();
        services.AddScoped<IChatTarget, PbiChatTarget>();
        services.AddScoped<IChatTarget, ReviewChatTarget>();

        return services;
    }
}
