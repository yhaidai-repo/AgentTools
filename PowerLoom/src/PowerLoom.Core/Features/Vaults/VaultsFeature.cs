using PowerLoom.Features.Vaults.Add;
using PowerLoom.Features.Vaults.Trash;

namespace PowerLoom.Features.Vaults;

public static class VaultsFeature
{
    public static IServiceCollection AddVaultsFeature(this IServiceCollection services)
    {
        services.AddSingleton<TrashFolder>();
        services.AddSingleton<VaultInitializer>();
        // After the database migrator (registered first): it reads the connected vaults.
        services.AddHostedService<OwnedFilesRefresher>();

        return services;
    }
}
