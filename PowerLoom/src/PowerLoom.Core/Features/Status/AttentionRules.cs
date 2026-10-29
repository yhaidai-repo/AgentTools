using PowerLoom.Persistence.Runs;
using PowerLoom.Features.Status.Models;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Features.Status;

// What the dashboard asks the user to look at: the rules planned as alerts (the monitoring design), computed from the
// status instead. Each names the scheme component it highlights.
public static class AttentionRules
{
    public const string DatabaseComponent = "database";
    public const string TickerComponent = "schedule-ticker";
    public const string RunnerComponent = "agent-runner";
    public const string MessagingComponent = "messaging";
    public const string SyncComponent = "ado-sync";
    public const string BudgetComponent = "budget";
    public const string RunsComponent = "agent-runs";

    private const int SyncFailuresInARow = 3;
    private const decimal BudgetWarningShare = 0.8m;

    public static List<Attention> Evaluate(ComponentState database, TickerStatus ticker, RunnerStatus runner, MessagingStatus messaging, List<RunInProgress> runs, List<SyncRun> syncs, BudgetStatus budget)
    {
        var attention = new List<Attention>();

        if (database.State != StateLevel.Ok)
            attention.Add(new Attention(DatabaseComponent, StateLevel.Failed, $"Database: {database.Detail}"));

        if (ticker.State != StateLevel.Ok)
            attention.Add(new Attention(TickerComponent, ticker.State, ticker.LastTickAt is null ? "The schedule ticker hasn't ticked since the start." : $"The schedule ticker is silent since {ticker.LastTickAt:u}."));

        if (!runner.Reachable)
            attention.Add(new Attention(RunnerComponent, StateLevel.Degraded, $"The agent-runner doesn't answer: {runner.Detail}"));

        if (messaging.DeadLetters > 0)
            attention.Add(new Attention(MessagingComponent, StateLevel.Degraded, $"{messaging.DeadLetters} dead letter(s) ({messaging.DeadLettersLast24h} in the last 24 h): see Dashboard → Application."));

        attention.AddRange(runs.Where(run => run.Stuck).Select(run => new Attention(RunsComponent, StateLevel.Degraded, $"{run.TaskId} ({run.AgentId}) is in progress since {run.Since:u}, past its timeout.")));
        attention.AddRange(SyncFailures(syncs));
        attention.AddRange(BudgetWarnings(budget));

        return attention;
    }

    private static IEnumerable<Attention> SyncFailures(List<SyncRun> syncs)
    {
        foreach (var stage in syncs.Select(run => run.Stage).Distinct())
        {
            var latest = syncs.Where(run => run.Stage == stage).Take(SyncFailuresInARow).ToList();

            if (latest.Count == SyncFailuresInARow && latest.All(run => run.Outcome == RunOutcome.Failed))
                yield return new Attention(SyncComponent, StateLevel.Failed, $"The last {SyncFailuresInARow} {Label(stage)} runs failed: {latest[0].Error}");
        }
    }

    private static IEnumerable<Attention> BudgetWarnings(BudgetStatus budget)
    {
        if (budget.DailyLimitUsd > 0 && budget.SpentTodayUsd >= budget.DailyLimitUsd * BudgetWarningShare)
            yield return new Attention(BudgetComponent, StateLevel.Degraded, $"Today's spend is {budget.SpentTodayUsd:0.00} USD of the daily {budget.DailyLimitUsd:0.00} USD.");

        foreach (var agent in budget.Agents.Where(agent => agent.DailyLimitUsd > 0 && agent.SpentTodayUsd >= agent.DailyLimitUsd * BudgetWarningShare))
            yield return new Attention(BudgetComponent, StateLevel.Degraded, $"{agent.AgentId} spent {agent.SpentTodayUsd:0.00} USD of its daily {agent.DailyLimitUsd:0.00} USD.");
    }

    private static string Label(string stage) => stage == JobStages.PullRequests ? "pull request check" : "PBI sync";
}
