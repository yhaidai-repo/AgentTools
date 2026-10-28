using System.Net;
using System.Text.Json;
using Alba;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Features.Sandbox;
using PowerLoom.Features.Sandbox.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Settings;

namespace PowerLoom.Api.Tests.Sandbox;

[Collection(PowerLoomCollection.Name)]
public sealed class SandboxSettingsTests(PowerLoomHost host) : IAsyncLifetime
{
    private const string Path = $"/api/vaults/{PowerLoomHost.Vault}/sandbox";

    public Task InitializeAsync() => ResetAsync();

    public Task DisposeAsync() => ResetAsync();

    [Fact]
    public async Task A_vault_starts_with_the_public_registries_and_the_catalog_default_image()
    {
        var setting = await host.Host.GetAsJson<SandboxSetting>(Path);

        Assert.Equal(["api.nuget.org", "registry.npmjs.org"], setting!.PackageHosts);
        Assert.Equal("", setting.Image);
    }

    [Fact]
    public async Task A_saved_setting_is_cleaned_and_stored_with_the_names_the_runner_reads()
    {
        var saved = await host.Host.PutJson(new SaveSandboxSettingsRequest([" API.nuget.org ", "*.example.com", "", "api.nuget.org"], " java "), Path).Receive<SandboxSetting>();
        var stored = await WithDbAsync(db => VaultSettings.ReadRawAsync(db, PowerLoomHost.Vault, SandboxSettingsStore.Key, CancellationToken.None));
        using var json = JsonDocument.Parse(stored!);
        var root = json.RootElement;

        Assert.Equal(["api.nuget.org", "*.example.com"], saved!.PackageHosts);
        Assert.Equal(["api.nuget.org", "*.example.com"], root.GetProperty("packageHosts").EnumerateArray().Select(host => host.GetString()));
        Assert.Equal("java", root.GetProperty("image").GetString());
    }

    [Theory]
    [InlineData("https://api.nuget.org", "", "Not a host name")]
    [InlineData("nuget", "", "Not a host name")]
    [InlineData("*.", "", "Not a host name")]
    [InlineData("api.nuget.org", "My Image", "Not an image name")]
    public async Task A_broken_setting_is_refused(string entry, string image, string message)
    {
        var refused = await host.Host.Scenario(scenario =>
        {
            scenario.Put.Json(new SaveSandboxSettingsRequest([entry], image)).ToUrl(Path);
            scenario.StatusCodeShouldBe(HttpStatusCode.BadRequest);
        });

        Assert.Contains(message, await refused.ReadAsTextAsync());
    }

    private Task ResetAsync() => WithDbAsync(db => GlobalSettings.DeleteAsync(db, VaultSettings.KeyOf(PowerLoomHost.Vault, SandboxSettingsStore.Key), CancellationToken.None));

    private async Task<T> WithDbAsync<T>(Func<PowerLoomDbContext, Task<T>> action)
    {
        using var scope = host.Host.Services.CreateScope();

        return await action(scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>());
    }

    private async Task WithDbAsync(Func<PowerLoomDbContext, Task> action)
    {
        using var scope = host.Host.Services.CreateScope();

        await action(scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>());
    }
}
