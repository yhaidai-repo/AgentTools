using Microsoft.Extensions.Options;
using PowerLoom.Infrastructure.Vaults;

namespace PowerLoom.Features.Vaults.Add;

// What a vault needs for PowerLoom's maintenance (user decision 2026-10-05): rules and registers from the templates, the
// drafts folder (VaultCapture), the usage log folder (VaultUsage), Obsidian's folder, so the vault is listed as one, and
// the connection to PowerLoom's MCP server (user decision 2026-10-24). Creates whatever is missing; existing files are
// never touched, except the files and the .mcp.json entry PowerLoom owns. Agent-app files (Claude's CLAUDE.md) are the
// app's own.
public sealed class VaultInitializer(VaultRoots roots, IOptions<VaultOptions> options, McpConnectionFile mcp, TimeProvider clock)
{
    private static readonly string[] Folders = ["draft", ".usage", ".obsidian"];

    // PowerLoom's own files in a vault (user decision 2026-10-13): the tools a Claude chat in the vault can call. They
    // follow PowerLoom's version, so they are rewritten whenever they differ from the template.
    private static readonly string[] OwnedFiles = ["POWERLOOM.md"];

    public async Task<IReadOnlyList<string>> PrepareAsync(string vault, CancellationToken cancellation)
    {
        var root = roots.RootOf(vault);
        var created = new List<string>();

        Directory.CreateDirectory(root);
        created.AddRange(Folders.Where(folder => CreateFolder(root, folder)).Select(folder => $"{folder}/"));

        foreach (var template in Directory.EnumerateFiles(options.Value.TemplateHome).Select(Path.GetFileName))
            created.AddRange(await CreateFromTemplateAsync(root, template!, vault, cancellation));

        if (await mcp.EnsureAsync(root, vault, cancellation))
            created.Add(McpConnectionFile.FileName);

        return created;
    }

    // Brings PowerLoom's own files and its MCP entry of a connected vault up to date; true when one changed.
    public async Task<bool> RefreshOwnedFilesAsync(string vault, CancellationToken cancellation)
    {
        var root = roots.RootOf(vault);
        var changed = false;

        if (!Directory.Exists(root))
            return false;

        foreach (var file in OwnedFiles)
            changed |= await RefreshAsync(root, file, vault, cancellation);

        changed |= await mcp.EnsureAsync(root, vault, cancellation);

        return changed;
    }

    private static bool CreateFolder(string root, string folder)
    {
        var path = Path.Combine(root, folder);

        if (Directory.Exists(path))
            return false;

        Directory.CreateDirectory(path);

        return true;
    }

    private async Task<IReadOnlyList<string>> CreateFromTemplateAsync(string root, string file, string vault, CancellationToken cancellation)
    {
        var target = Path.Combine(root, file);

        if (File.Exists(target))
            return [];

        await File.WriteAllTextAsync(target, await RenderAsync(file, vault, cancellation), cancellation);

        return [file];
    }

    private async Task<bool> RefreshAsync(string root, string file, string vault, CancellationToken cancellation)
    {
        var target = Path.Combine(root, file);
        var content = await RenderAsync(file, vault, cancellation);

        if (File.Exists(target) && await File.ReadAllTextAsync(target, cancellation) == content)
            return false;

        await File.WriteAllTextAsync(target, content, cancellation);

        return true;
    }

    // `{{vaultPath}}` is the vault's path on the PC, `{{vaultName}}` its name, `{{date}}` today.
    private async Task<string> RenderAsync(string file, string vault, CancellationToken cancellation)
    {
        var template = await File.ReadAllTextAsync(Path.Combine(options.Value.TemplateHome, file), cancellation);

        return template
            .Replace("{{vaultPath}}", $"{options.Value.HostRoot.Replace('\\', '/').TrimEnd('/')}/{vault}")
            .Replace("{{vaultName}}", vault)
            .Replace("{{date}}", clock.GetUtcNow().ToString("yyyy-MM-dd"));
    }
}
