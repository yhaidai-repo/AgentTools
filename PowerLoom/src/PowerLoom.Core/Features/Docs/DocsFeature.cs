using PowerLoom.Features.Docs.Records;

namespace PowerLoom.Features.Docs;

public static class DocsFeature
{
    public static IServiceCollection AddDocsFeature(this IServiceCollection services)
    {
        services.AddScoped<RecordSources>();
        services.AddScoped<IRecordWriter, WwwRecordWriter>();
        services.AddScoped<IRecordWriter, FindingRecordWriter>();

        return services;
    }
}
