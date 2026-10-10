using Microsoft.Extensions.Options;
using PowerLoom.Infrastructure.Vaults;

namespace PowerLoom.Features.Vaults.Add;

// What a vault needs for adoa's maintenance (user decision 2026-10-05): rules and registers from the templates, the
// drafts folder (VaultCapture), the usage log folder (VaultUsage) and Obsidian's folder, so the vault is listed as one.
// Creates whatever is missing; existing files are never touched. Agent-app files (Claude's CLAUDE.md) are the app's own.
public sealed class VaultInitializer(VaultRoots roots, IOptions<VaultOptions> options, TimeProvider clock)
{
    private static readonly string[] Folders = ["draft", ".usage", ".obsidian"];

    public async Task<IReadOnlyList<string>> PrepareAsync(string vault, CancellationToken cancellation)
    {
        var root = roots.RootOf(vault);
        var created = new List<string>();

        Directory.CreateDirectory(root);
        created.AddRange(Folders.Where(folder => CreateFolder(root, folder)).Select(folder => $"{folder}/"));

        foreach (var template in Directory.EnumerateFiles(options.Value.TemplateHome).Select(Path.GetFileName))
            created.AddRange(await CreateFromTemplateAsync(root, template!, vault, cancellation));

        return created;
    }

    private static bool CreateFolder(string root, string folder)
    {
        var path = Path.Combine(root, folder);

        if (Directory.Exists(path))
            return false;

        Directory.CreateDirectory(path);

        return true;
    }

    // `{{vaultPath}}` is the vault's path on the PC, `{{date}}` today.
    private async Task<IReadOnlyList<string>> CreateFromTemplateAsync(string root, string file, string vault, CancellationToken cancellation)
    {
        var target = Path.Combine(root, file);

        if (File.Exists(target))
            return [];

        var template = await File.ReadAllTextAsync(Path.Combine(options.Value.TemplateHome, file), cancellation);
        var content = template
            .Replace("{{vaultPath}}", $"{options.Value.HostRoot.Replace('\\', '/').TrimEnd('/')}/{vault}")
            .Replace("{{date}}", clock.GetUtcNow().ToString("yyyy-MM-dd"));

        await File.WriteAllTextAsync(target, content, cancellation);

        return [file];
    }
}
