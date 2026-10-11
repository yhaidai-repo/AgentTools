using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;
using PowerLoom.Infrastructure.Skills.Models;

namespace PowerLoom.Infrastructure.Skills;

// The skills as the agent-runner reads them (the AgentRuntime module's skillFiles): `<folder>/<name>/SKILL.md`.
public sealed partial class SkillFiles(IOptions<SkillsOptions> options)
{
    private const string FileName = "SKILL.md";

    // The SKILL.md the runner would load, or null when no folder has the skill (or the name isn't a skill name).
    public async Task<SkillFile?> ReadAsync(string name, CancellationToken cancellation)
    {
        if (!SkillName().IsMatch(name))
            return null;

        foreach (var folder in options.Value.Folders)
        {
            var path = Path.Combine(folder, name, FileName);

            if (File.Exists(path))
                return new SkillFile(name, folder, path, await File.ReadAllTextAsync(path, cancellation));
        }

        return null;
    }

    // Every skill the folders offer (a folder with a SKILL.md), as the agents may load them.
    public IReadOnlySet<string> Names()
    {
        return options.Value.Folders.Where(Directory.Exists)
            .SelectMany(folder => Directory.EnumerateDirectories(folder).Where(skill => File.Exists(Path.Combine(skill, FileName))).Select(Path.GetFileName))
            .Where(name => name is not null)
            .Select(name => name!)
            .ToHashSet();
    }

    public bool IsEditable(string folder) => options.Value.Editable.Length > 0 && folder == options.Value.Editable;

    // Rewrites an existing skill only (no new skills, user decision 2026-10-01). Returns why it was refused, or null.
    public async Task<string?> WriteAsync(SkillFile file, string content, CancellationToken cancellation)
    {
        var problem = ContentProblem(content);

        if (problem is not null)
            return problem;

        await File.WriteAllTextAsync(file.Path, content, cancellation);

        return null;
    }

    // Agents see a skill by its frontmatter description, so it must stay.
    private static string? ContentProblem(string content)
    {
        if (!content.StartsWith("---", StringComparison.Ordinal))
            return "SKILL.md must start with its frontmatter (---).";

        var frontmatter = Frontmatter().Match(content);
        var hasDescription = frontmatter.Success && DescriptionField().IsMatch(frontmatter.Groups[1].Value);

        return hasDescription ? null : "The frontmatter needs a description: line; agents choose skills by it.";
    }

    // A skill name is a folder name; anything else (e.g. "../x") could leave the skill folders.
    [GeneratedRegex("^[a-z0-9][a-z0-9-]*$")]
    private static partial Regex SkillName();

    [GeneratedRegex(@"^---\r?\n([\s\S]*?)\r?\n---")]
    private static partial Regex Frontmatter();

    [GeneratedRegex(@"^description:\s*(.+)$", RegexOptions.Multiline)]
    private static partial Regex DescriptionField();
}
