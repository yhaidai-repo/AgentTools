using PowerLoom.Features.Status.Models;

namespace PowerLoom.Features.Status;

// When an outside system the agents read needs the user (user decision 2026-10-15: the scheme shows it): an open
// access request, or the last calls to one resource all failed while no request covers it. A system with a recent
// successful read is ok; one with neither isn't listed.
public static class OutsideAccessRules
{
    private const int FailureStreak = 3;
    private const int MaxReasonChars = 160;

    private static readonly string[] FailedOutcomes = ["denied", "failed"];

    public static OutsideAccessReport Evaluate(OutsideAccessData data)
    {
        var attention = data.Requests.SelectMany(RequestAttention).Concat(Streaks(data)).ToList();
        var states = OutsideComponents.All.Select(component => StateOf(component, data.Calls, attention)).OfType<OutsideComponentState>().ToList();

        return new OutsideAccessReport(states, attention);
    }

    private static IEnumerable<Attention> RequestAttention(OutsideAccessRequest request)
    {
        var component = OutsideComponents.Of(request.Kind);

        return component is null ? [] : [new Attention(component.Component, StateLevel.Degraded, $"{request.Id} is open: {request.Title}.")];
    }

    // A resource whose last calls all failed, unless an open request already asks for it.
    private static IEnumerable<Attention> Streaks(OutsideAccessData data)
    {
        return data.Calls
            .GroupBy(call => (call.Kind, call.Resource))
            .Where(group => !IsRequested(data.Requests, group.Key.Kind, group.Key.Resource))
            .Select(group => group.Take(FailureStreak).ToList())
            .Where(IsFailureStreak)
            .Select(StreakAttention)
            .OfType<Attention>();
    }

    private static bool IsRequested(List<OutsideAccessRequest> requests, string kind, string resource)
    {
        return requests.Any(request => request.Kind == kind && request.Resource == resource);
    }

    private static bool IsFailureStreak(List<OutsideCall> latest)
    {
        return latest.Count == FailureStreak && latest.All(call => FailedOutcomes.Contains(call.Outcome));
    }

    private static Attention? StreakAttention(List<OutsideCall> latest)
    {
        var call = latest[0];
        var component = OutsideComponents.Of(call.Kind);
        var reason = (call.Reason ?? call.Outcome).ReplaceLineEndings(" ");

        return component is null ? null : new Attention(component.Component, StateLevel.Degraded, $"The last {FailureStreak} agent calls to {call.Resource} failed: {Cut(reason)}");
    }

    private static OutsideComponentState? StateOf(OutsideComponent component, List<OutsideCall> calls, List<Attention> attention)
    {
        var problem = attention.FirstOrDefault(item => item.Component == component.Component);

        if (problem is not null)
            return new OutsideComponentState(component.Component, component.Tool, StateLevel.Degraded, problem.Message);

        var lastOk = calls.FirstOrDefault(call => component.Kinds.Contains(call.Kind) && call.Outcome == "ok");

        return lastOk is null ? null : new OutsideComponentState(component.Component, component.Tool, StateLevel.Ok, $"last read {lastOk.StartedAt:u}");
    }

    private static string Cut(string text) => text.Length <= MaxReasonChars ? text : $"{text[..MaxReasonChars]}…";
}
