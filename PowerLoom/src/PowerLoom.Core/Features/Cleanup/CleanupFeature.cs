using PowerLoom.Features.Cleanup.Cleaners;
using PowerLoom.Infrastructure.Scheduling;

namespace PowerLoom.Features.Cleanup;

public static class CleanupFeature
{
    public static IServiceCollection AddCleanupFeature(this IServiceCollection services)
    {
        services.AddSingleton<ICronSource, CleanupCronSource>();
        services.AddScoped<CleanupSettingsStore>();
        services.AddScoped<CleanupLog>();
        services.AddScoped<IArtefactCleaner, ClosedPbiFoldersCleaner>();
        services.AddScoped<IArtefactCleaner, FailedImportsCleaner>();
        services.AddScoped<IArtefactCleaner, TrashCleaner>();
        services.AddScoped<IArtefactCleaner, RunEventsCleaner>();

        return services;
    }
}
