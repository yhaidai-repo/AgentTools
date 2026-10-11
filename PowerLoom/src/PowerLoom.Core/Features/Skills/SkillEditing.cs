using System.Security.Cryptography;
using System.Text;
using PowerLoom.Contracts;
using PowerLoom.Infrastructure.Skills;
using PowerLoom.Infrastructure.Skills.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;

namespace PowerLoom.Features.Skills;

// Saves an existing skill. Refused when the file changed since the editor loaded it (`expectedHash`), so nobody's edit
// is lost; the version it replaces is kept as a revision first (user decision 2026-10-01).
public sealed class SkillEditing(PowerLoomDbContext db, SkillFiles files)
{
    public static string ContentHash(string content) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(content)));

    // True when the file changed.
    public async Task<Outcome<bool>> SaveAsync(string name, string content, string expectedHash, CancellationToken cancellation)
    {
        var current = await files.ReadAsync(name, cancellation);

        if (current is null)
            return Outcome<bool>.Failure(Problem.NotFound($"No skill named {name}; PowerLoom only edits existing skills."));

        if (!files.IsEditable(current.Folder))
            return Outcome<bool>.Failure(Problem.Invalid($"{name} isn't one of PowerLoom's own skills; edit it where it lives (PowerLoom only views it)."));

        if (ContentHash(current.Content) != expectedHash)
            return Outcome<bool>.Failure(Problem.Conflict("The skill changed since you opened it. Reload the page and apply your edit again."));

        if (current.Content == content)
            return Outcome<bool>.Success(false);

        return await ReplaceAsync(current, content, cancellation);
    }

    private async Task<Outcome<bool>> ReplaceAsync(SkillFile current, string content, CancellationToken cancellation)
    {
        var revision = new SkillRevision { Name = current.Name, Folder = current.Folder, Content = current.Content };

        db.SkillRevisions.Add(revision);
        await db.SaveChangesAsync(cancellation);

        var problem = await files.WriteAsync(current, content, cancellation);

        if (problem is null)
            return Outcome<bool>.Success(true);

        db.SkillRevisions.Remove(revision);
        await db.SaveChangesAsync(cancellation);

        return Outcome<bool>.Failure(Problem.Invalid(problem));
    }
}
