using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PowerLoom.Contracts;
using PowerLoom.Features.Vaults.Add.Models;
using PowerLoom.Infrastructure.Http;
using PowerLoom.Infrastructure.Vaults;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using Wolverine.Http;

namespace PowerLoom.Features.Vaults.Add;

// Settings → Add vault: a folder of the vaults root becomes a vault with every feature off; one removed earlier comes
// back as it was. The folder needn't exist: it is prepared from adoa's templates.
public static class AddVaultEndpoint
{
    private const string NoFeatures = """{"adoSync":false,"mailSync":false,"pullRequests":false}""";

    [WolverinePost("/api/vaults")]
    public static async Task<Results<Ok<AddedVault>, ProblemHttpResult>> Post(AddVaultRequest request, PowerLoomDbContext db, VaultInitializer initializer, IOptions<VaultOptions> options, CancellationToken cancellation)
    {
        var name = VaultFolderName.Parse(request.Folder, options.Value.HostRoot);

        if (!name.Ok)
            return name.Problem.ToProblemResult();

        var problem = await AddProblemAsync(db, name.Value, options.Value, cancellation);

        if (problem is not null)
            return problem.ToProblemResult();

        await AddOrRestoreAsync(db, name.Value, cancellation);

        var created = await initializer.PrepareAsync(name.Value, cancellation);

        return TypedResults.Ok(new AddedVault(name.Value, created));
    }

    private static async Task<Problem?> AddProblemAsync(PowerLoomDbContext db, string name, VaultOptions options, CancellationToken cancellation)
    {
        if (options.ExcludedNames.Contains(name))
            return Problem.Invalid($"{name} is adoa's own vault and can't be added.");

        var active = await db.Vaults.AnyAsync(vault => vault.Name == name && vault.RemovedAt == null, cancellation);

        return active ? Problem.Conflict($"{name} is a vault already.") : null;
    }

    private static async Task AddOrRestoreAsync(PowerLoomDbContext db, string name, CancellationToken cancellation)
    {
        var existing = await db.Vaults.FindAsync([name], cancellation);

        if (existing is null)
            db.Vaults.Add(new Vault { Name = name, Features = NoFeatures });
        else
            existing.RemovedAt = null;

        await db.SaveChangesAsync(cancellation);
    }
}
