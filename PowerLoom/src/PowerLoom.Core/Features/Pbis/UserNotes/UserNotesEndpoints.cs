using Microsoft.AspNetCore.Http.HttpResults;
using PowerLoom.Features.Pbis.UserNotes.Models;
using PowerLoom.Infrastructure.Http;
using Wolverine.Http;

namespace PowerLoom.Features.Pbis.UserNotes;

// The PBI page's My notes tab.
public static class UserNotesEndpoints
{
    [WolverineGet("/api/pbis/{adoId}/user-notes")]
    public static async Task<Results<Ok<PbiUserNotes>, ProblemHttpResult>> Get(int adoId, UserNotesFile notes, CancellationToken cancellation) => (await notes.ReadAsync(adoId, cancellation)).ToResult();

    [WolverinePut("/api/pbis/{adoId}/user-notes")]
    public static async Task<Results<Ok<PbiUserNotes>, ProblemHttpResult>> Put(int adoId, SaveUserNotesRequest request, UserNotesFile notes, CancellationToken cancellation) => (await notes.SaveAsync(adoId, request, cancellation)).ToResult();
}
