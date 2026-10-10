using PowerLoom.Features.Vaults.Trash;

namespace PowerLoom.Features.Vaults;

public static class VaultsFeature
{
    public static IServiceCollection AddVaultsFeature(this IServiceCollection services)
    {
        services.AddSingleton<TrashFolder>();

        return services;
    }
}
