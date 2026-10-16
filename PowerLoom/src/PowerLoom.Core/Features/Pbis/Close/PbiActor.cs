using PowerLoom.Features.Pbis.Close.Models;

namespace PowerLoom.Features.Pbis.Close;

// Who closes or reopens: the caller's actor (e.g. "cli"), the person at the browser when it names none.
public static class PbiActor
{
    private const string Human = "human";

    public static string Of(PbiIdsRequest request) => string.IsNullOrWhiteSpace(request.Actor) ? Human : request.Actor.Trim();
}
