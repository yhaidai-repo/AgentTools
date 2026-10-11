using PowerLoom.Infrastructure.Repos;

namespace PowerLoom.Features.Repos;

public static class ReposFeature
{
    public static IServiceCollection AddReposFeature(this IServiceCollection services)
    {
        services.AddOptions<ReposOptions>().BindConfiguration(ReposOptions.Section);

        return services;
    }
}
