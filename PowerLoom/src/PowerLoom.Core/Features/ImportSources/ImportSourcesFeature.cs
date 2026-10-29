using PowerLoom.Contracts.Imports;
using PowerLoom.Features.ImportSources.Sources;

namespace PowerLoom.Features.ImportSources;

// Every import source the PBI sync reads, in this order. A new source is one class and one line here.
public static class ImportSourcesFeature
{
    public static IServiceCollection AddImportSourcesFeature(this IServiceCollection services)
    {
        services.AddOptions<ImportOptions>().BindConfiguration(ImportOptions.Section);
        services.AddScoped<ImportSettingsStore>();
        services.AddScoped<IPbiImportSource, OutlookMailSource>();

        return services;
    }
}
