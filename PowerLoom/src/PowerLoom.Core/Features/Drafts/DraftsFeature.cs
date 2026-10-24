using PowerLoom.Infrastructure.Scheduling;

namespace PowerLoom.Features.Drafts;

public static class DraftsFeature
{
    public static IServiceCollection AddDraftsFeature(this IServiceCollection services)
    {
        services.AddSingleton<ICronSource, DraftsCronSource>();

        return services;
    }
}
