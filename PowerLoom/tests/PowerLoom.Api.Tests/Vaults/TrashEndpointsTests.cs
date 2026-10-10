using System.Net;
using Alba;
using PowerLoom.Features.Vaults.Trash.Models;

namespace PowerLoom.Api.Tests.Vaults;

[Collection(PowerLoomCollection.Name)]
public sealed class TrashEndpointsTests(PowerLoomHost host)
{
    private readonly string _trash = $"/api/vaults/{PowerLoomHost.Vault}/trash";

    [Fact]
    public async Task List_returns_trashed_files_newest_first()
    {
        TrashFile("notes/old.md", DateTime.UtcNow.AddDays(-2));
        TrashFile("notes/new.md", DateTime.UtcNow);

        var entries = await host.Host.GetAsJson<List<TrashEntry>>(_trash);

        // The trash is shared by every test here, so only this test's folder is compared.
        Assert.Equal(["notes/new.md", "notes/old.md"], entries!.Select(entry => entry.Path).Where(path => path.StartsWith("notes/")));
    }

    [Fact]
    public async Task Restore_moves_the_file_back()
    {
        TrashFile("restore/back.md", DateTime.UtcNow);

        await host.Host.Scenario(scenario =>
        {
            scenario.Post.Json(new TrashPathRequest("restore/back.md")).ToUrl($"{_trash}/restore");
            scenario.StatusCodeShouldBeOk();
        });

        Assert.True(File.Exists(Path.Combine(host.VaultRoot, "restore", "back.md")));
        Assert.False(File.Exists(Path.Combine(host.VaultRoot, ".trash", "restore", "back.md")));
    }

    [Fact]
    public async Task Restore_is_refused_when_the_note_exists_again()
    {
        TrashFile("conflict/note.md", DateTime.UtcNow);
        WriteVaultFile("conflict/note.md");

        await host.Host.Scenario(scenario =>
        {
            scenario.Post.Json(new TrashPathRequest("conflict/note.md")).ToUrl($"{_trash}/restore");
            scenario.StatusCodeShouldBe(HttpStatusCode.Conflict);
        });
    }

    [Fact]
    public async Task Delete_removes_the_file_for_good()
    {
        TrashFile("delete/gone.md", DateTime.UtcNow);

        await host.Host.Scenario(scenario =>
        {
            scenario.Delete.Json(new TrashPathRequest("delete/gone.md")).ToUrl(_trash);
            scenario.StatusCodeShouldBeOk();
        });

        Assert.False(File.Exists(Path.Combine(host.VaultRoot, ".trash", "delete", "gone.md")));
    }

    [Fact]
    public async Task A_path_outside_the_trash_is_refused()
    {
        await host.Host.Scenario(scenario =>
        {
            scenario.Delete.Json(new TrashPathRequest("../AGENTS.md")).ToUrl(_trash);
            scenario.StatusCodeShouldBe(HttpStatusCode.BadRequest);
        });
    }

    [Fact]
    public async Task An_unknown_vault_is_not_found()
    {
        await host.Host.Scenario(scenario =>
        {
            scenario.Get.Url("/api/vaults/no-such-vault/trash");
            scenario.StatusCodeShouldBe(HttpStatusCode.NotFound);
        });
    }

    private void TrashFile(string path, DateTime modified)
    {
        var file = Path.Combine(host.VaultRoot, ".trash", path);

        Directory.CreateDirectory(Path.GetDirectoryName(file)!);
        File.WriteAllText(file, "trashed");
        File.SetLastWriteTimeUtc(file, modified);
    }

    private void WriteVaultFile(string path)
    {
        var file = Path.Combine(host.VaultRoot, path);

        Directory.CreateDirectory(Path.GetDirectoryName(file)!);
        File.WriteAllText(file, "current");
    }
}
