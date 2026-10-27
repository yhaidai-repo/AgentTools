using System.Net;
using System.Text.Json.Nodes;
using Alba;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Features.Tasks.EditTask.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;

namespace PowerLoom.Api.Tests.Tasks;

// Editing an agent task's text (user decision 2026-10-26): title, description and acceptance criteria, whenever it isn't
// running; a human task and a running one are refused, and too long a title too.
[Collection(PowerLoomCollection.Name)]
public sealed class EditTaskTests(PowerLoomHost host)
{
    [Fact]
    public async Task A_finished_task_takes_its_new_text_and_a_running_or_human_one_is_refused()
    {
        await SeedAsync();

        var edited = await host.Host.Scenario(scenario => scenario.Put.Json(Edit("Better title")).ToUrl("/api/tasks/GT-EDIT-1"));
        await RefusedAsync("GT-EDIT-2", Edit("Running"), HttpStatusCode.Conflict);
        await RefusedAsync("HT-EDIT-3", Edit("Human"), HttpStatusCode.NotFound);
        await RefusedAsync("GT-EDIT-1", Edit(new string('x', 121)), HttpStatusCode.BadRequest);

        using var scope = host.Host.Services.CreateScope();
        var task = await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().LocalItems.AsNoTracking().SingleAsync(item => item.Id == "GT-EDIT-1");
        var data = JsonNode.Parse(task.Data!)!.AsObject();

        Assert.Equal("GT-EDIT-1", (await edited.ReadAsJsonAsync<EditedTask>())!.Id);
        Assert.Equal(("Better title", "Check the new API", ItemStatus.Done), (task.Title, task.Body, task.Status));
        Assert.Equal(("Lists every endpoint", "Lists every endpoint", "user"), (data["doneWhen"]!.GetValue<string>(), data["goal"]!.GetValue<string>(), data["createdBy"]!.GetValue<string>()));
    }

    private static EditTaskRequest Edit(string title) => new(null, title, "Check the new API", "Lists every endpoint");

    private async Task RefusedAsync(string id, EditTaskRequest request, HttpStatusCode status)
    {
        await host.Host.Scenario(scenario =>
        {
            scenario.Put.Json(request).ToUrl($"/api/tasks/{id}");
            scenario.StatusCodeShouldBe(status);
        });
    }

    private async Task SeedAsync()
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        const string data = """{"goal":"Old criteria","doneWhen":"Old criteria","createdBy":"user","repos":[]}""";

        db.LocalItems.Add(new LocalItem { Id = "GT-EDIT-1", Kind = ItemKinds.Research, Vault = PowerLoomHost.Vault, Title = "Old title", Body = "Old", Status = ItemStatus.Done, Assignee = "agent:*", HeldBy = "[]", Data = data });
        db.LocalItems.Add(new LocalItem { Id = "GT-EDIT-2", Kind = ItemKinds.Research, Vault = PowerLoomHost.Vault, Title = "Running", Body = "Old", Status = ItemStatus.InProgress, Assignee = "agent:*", HeldBy = "[]", Data = data });
        db.LocalItems.Add(new LocalItem { Id = "HT-EDIT-3", Kind = ItemKinds.Human, Vault = PowerLoomHost.Vault, Title = "Human", Body = "Old", Status = ItemStatus.Open, Assignee = "human", HeldBy = "[]" });
        await db.SaveChangesAsync();
    }
}
