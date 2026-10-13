using PowerLoom.Features.Pbis.Notes;
using PowerLoom.Features.Pbis.UserNotes;
using PowerLoom.Infrastructure.Backlog;

namespace PowerLoom.Features.Pbis;

public static class PbisFeature
{
    public static IServiceCollection AddPbisFeature(this IServiceCollection services)
    {
        services.AddScoped<PbiNoteWriter>();
        services.AddScoped<PbiNotesRenderer>();
        services.AddScoped<DraftWriter>();
        services.AddScoped<UserNotesFile>();
        // An integration library replaces this with links to its tracker.
        services.AddScoped<IWorkItemLinks, NoWorkItemLinks>();

        return services;
    }
}
