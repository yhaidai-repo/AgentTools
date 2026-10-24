using PowerLoom.Features.Meetings.Import;
using PowerLoom.Infrastructure.Scheduling;

namespace PowerLoom.Features.Meetings;

// Recorded meetings (tools/audio-capture): the inbox reader, the transcript note and the meeting task.
public static class MeetingsFeature
{
    public static IServiceCollection AddMeetingsFeature(this IServiceCollection services)
    {
        services.AddScoped<MeetingImportSync>();
        services.AddScoped<MeetingTaskCreation>();
        services.AddSingleton<ICronSource, MeetingsCronSource>();

        return services;
    }
}
