using PowerLoom.Features.Meetings.Models;

namespace PowerLoom.Features.Meetings.Import;

public static class ImportMeetingsHandler
{
    public static async Task Handle(ImportMeetings message, MeetingImportSync sync, ILogger<ImportMeetings> logger, CancellationToken cancellation)
    {
        var messages = await sync.RunAsync(message.Vault, cancellation);

        if (messages.Count > 0)
            logger.LogInformation("meetings import {Vault}: {Messages}", message.Vault, string.Join("; ", messages));
    }
}
