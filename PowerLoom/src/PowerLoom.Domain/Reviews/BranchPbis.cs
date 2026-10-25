using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Persistence;

namespace PowerLoom.Domain.Reviews;

// A branch review's linked PBI: the one named, or the number in the branch name when that is a PBI of the vault
// (create-branch names branches so: feature/30474-…).
public static partial class BranchPbis
{
    public static async Task<Outcome<List<int>>> LinkAsync(PowerLoomDbContext db, string vault, string? pbi, string branch, CancellationToken cancellation)
    {
        if (!string.IsNullOrWhiteSpace(pbi))
        {
            var named = int.TryParse(pbi.Trim().TrimStart('#'), out var id) && await IsPbiOfAsync(db, vault, id, cancellation);

            return named ? Outcome<List<int>>.Success([id]) : Outcome<List<int>>.Failure(Problem.NotFound($"{pbi} isn't a PBI of {vault}."));
        }

        var match = BranchPbi().Match(branch);

        if (match.Success && int.TryParse(match.Groups[1].Value, out var fromBranch) && await IsPbiOfAsync(db, vault, fromBranch, cancellation))
            return Outcome<List<int>>.Success([fromBranch]);

        return Outcome<List<int>>.Success([]);
    }

    private static Task<bool> IsPbiOfAsync(PowerLoomDbContext db, string vault, int adoId, CancellationToken cancellation) => db.WorkItems.AnyAsync(item => item.AdoId == adoId && item.Vault == vault, cancellation);

    [GeneratedRegex(@"(?:^|/)(\d{4,7})(?:[-_/.]|$)")]
    private static partial Regex BranchPbi();
}
