using System.Text.Encodings.Web;
using System.Text.Json;
using PowerLoom.Domain.Pbis;
using PowerLoom.Features.Docs.Records.Models;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Features.Continue.Targets;

// The "At the end" section of an item's chat (user decision 2026-10-21): the PowerLoom commands that close the item,
// with its ids filled in, so the chat ends the session in PowerLoom instead of handing text over to paste.
public static class ItemChatEndings
{
    public const string Heading = "At the end";

    private const string AskFirst = "Show the user the exact input first and run the command only after their yes. The input goes on stdin (a heredoc), so the text needs no shell quoting.";

    // Placeholders like <the answer> stay readable: no < escapes in a note for a person.
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

    public static string Markdown(LocalItem item)
    {
        var lines = AgentStages.IsAgentTask(item.Assignee) ? AgentTask(item) : ByKind(item);

        return string.Join("\n", lines.Select(line => $"- {line}").Prepend(AskFirst));
    }

    private static IEnumerable<string> ByKind(LocalItem item)
    {
        return item.Kind switch
        {
            ItemKind.Question => Question(item),
            ItemKind.Human => HumanTask(item),
            ItemKind.Finding => Finding(item),
            _ => [],
        };
    }

    private static IEnumerable<string> Question(LocalItem item)
    {
        yield return Close(item, "Use the answer", "answer", "<the answer, markdown>");
        yield return Close(item, "Dismiss the question", "dismiss", "<why it needs no answer>");
    }

    private static IEnumerable<string> HumanTask(LocalItem item)
    {
        var steps = StepCount(item.Data);
        var answers = Enumerable.Range(1, steps).Select(step => $"<result of step {step}>").ToArray();
        var done = new { itemId = item.Id, adoId = item.PbiId, decision = "done", answers, resolution = "<note, or empty>" };

        yield return $"Task done: `{Command("item.close")}` with {Serialize(done)}: one entry per step in order, \"\" for a step without a result.";
        yield return Close(item, "Cancel the task", "cancel", "<why>");
    }

    private static IEnumerable<string> Finding(LocalItem item)
    {
        var data = FindingData.Parse(item.Data);
        var project = string.IsNullOrWhiteSpace(data?.Project) ? "<project folder name>" : data.Project;
        var question = new { itemId = item.Id, adoId = item.PbiId, type = "question", project, title = "<final title>", text = "<final text>", @default = new[] { "<default, one per entry>" }, options = new[] { "<option 1>", "<option 2>" } };
        var issue = new { itemId = item.Id, adoId = item.PbiId, type = "issue", project, title = "<final title>", text = "<final text>", @default = new[] { "<workaround or default, one per entry>" } };

        yield return $"Submit to the vault as an open question: `{Command("finding.submit")}` with {Serialize(question)}.";
        yield return $"Submit as a known issue: `{Command("finding.submit")}` with {Serialize(issue)}.";
        yield return Close(item, "Answer it without a record", "answer", "<the answer>");
        yield return Close(item, "Dismiss it", "dismiss", "<why>");
    }

    private static IEnumerable<string> AgentTask(LocalItem item)
    {
        var rerun = new { itemId = item.Id, adoId = item.PbiId, startOver = false };

        yield return $"Run the task again: `{Command("task.rerun")}` with {Serialize(rerun)} (`startOver: true` drops the last run's conversation). Anything else for PowerLoom (an answer to a question it raised) goes through that item's own page.";
    }

    private static string Close(LocalItem item, string label, string decision, string resolution)
    {
        var input = new { itemId = item.Id, adoId = item.PbiId, decision, resolution };

        return $"{label}: `{Command("item.close")}` with {Serialize(input)}.";
    }

    private static string Command(string name) => $"{ChatNote.PowerLoomCli} {name}";

    private static string Serialize(object input) => $"`{JsonSerializer.Serialize(input, Json)}`";

    // A structured human task's `data` holds its steps; a plain one has none and takes the note alone.
    private static int StepCount(string? data)
    {
        if (data is null)
            return 0;

        using var document = JsonDocument.Parse(data);

        return document.RootElement.TryGetProperty("steps", out var steps) && steps.ValueKind == JsonValueKind.Array ? steps.GetArrayLength() : 0;
    }
}
