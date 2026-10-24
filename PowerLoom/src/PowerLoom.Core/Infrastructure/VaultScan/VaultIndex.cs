using PowerLoom.Infrastructure.VaultScan.Models;

namespace PowerLoom.Infrastructure.VaultScan;

// One vault's notes, their links resolved the way Obsidian does (by file name anywhere in the vault, or by path), and
// each note's last use from VaultUsage's log.
public sealed class VaultIndex
{
    private readonly Dictionary<string, List<string>> _byName = new();
    private readonly Dictionary<string, string> _byPath = new();
    private readonly List<WikiLink> _links;
    private readonly Dictionary<string, List<WikiLink>> _inbound = new();
    private readonly Dictionary<string, DateTime> _lastUses = new();

    public VaultIndex(string vault, IReadOnlyList<ScannedNote> notes, IReadOnlyList<string> otherFiles, IReadOnlyList<VaultUsageEvent> usage)
    {
        Vault = vault;
        Notes = notes;
        Usage = usage;

        foreach (var path in notes.Select(note => note.Path).Concat(otherFiles).Order(StringComparer.Ordinal))
            AddFile(path);

        _links = notes.SelectMany(note => WikiLinks.Parse(note.Path, note.Content)).ToList();

        foreach (var link in _links)
            AddInbound(link);

        foreach (var entry in usage.Where(UsageLog.IsUse))
            AddUse(entry);
    }

    public string Vault { get; }

    public IReadOnlyList<ScannedNote> Notes { get; }

    public IReadOnlyList<VaultUsageEvent> Usage { get; }

    // Links from other notes to this one.
    public IReadOnlyList<WikiLink> LinksTo(string path) => _inbound.GetValueOrDefault(path) ?? [];

    // The file a link target points to; null for a dead link.
    public string? Resolve(string target)
    {
        var key = WikiLinks.LinkKey(target);

        if (!key.Contains('/'))
            return _byName.GetValueOrDefault(key)?.FirstOrDefault();

        return _byPath.GetValueOrDefault(key) ?? _byPath.FirstOrDefault(entry => entry.Key.EndsWith($"/{key}", StringComparison.Ordinal)).Value;
    }

    // Links whose target is no file of the vault.
    public IReadOnlyList<WikiLink> DeadLinks() => _links.Where(link => Resolve(link.Target) is null).ToList();

    public DateTime? LastUse(string path) => _lastUses.TryGetValue(path, out var at) ? at : null;

    // The log's first event: "never used" means something only once the log is old enough.
    public DateTime? LogStartedAt() => Usage.Count == 0 ? null : Usage.Min(entry => entry.At);

    private void AddFile(string path)
    {
        var key = WikiLinks.LinkKey(path);
        var name = key.Split('/').Last();

        _byPath[key] = path;
        _byName[name] = [.. _byName.GetValueOrDefault(name) ?? [], path];
    }

    private void AddInbound(WikiLink link)
    {
        var target = Resolve(link.Target);

        if (target is null || target == link.From)
            return;

        _inbound[target] = [.. _inbound.GetValueOrDefault(target) ?? [], link];
    }

    private void AddUse(VaultUsageEvent entry)
    {
        if (!_lastUses.TryGetValue(entry.File, out var latest) || latest < entry.At)
            _lastUses[entry.File] = entry.At;
    }
}
