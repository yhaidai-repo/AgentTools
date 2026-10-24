using Microsoft.EntityFrameworkCore;
using PowerLoom.Persistence;

namespace PowerLoom.Domain.Tasks;

// App-generated items carry a key naming their subject (local_item.data.key), so a rerun never creates the same item
// twice, whatever its status. A unique index (PBI, key) backs this up.
public static class ItemKeys
{
    public static string DraftKey(int captureId) => $"draft:{captureId}";

    public static string DocumentKey(string url) => $"doc:{url}";

    public static string RepoConfirmationKey(IEnumerable<string> repos) => $"repos:{string.Join(",", repos.Order(StringComparer.Ordinal))}";

    public static Task<bool> HasItemWithKeyAsync(PowerLoomDbContext db, int adoId, string key, CancellationToken cancellation)
    {
        return db.LocalItems.FromSql($"select * from local_item where pbi_id = {adoId} and data->>'key' = {key}").AnyAsync(cancellation);
    }
}
