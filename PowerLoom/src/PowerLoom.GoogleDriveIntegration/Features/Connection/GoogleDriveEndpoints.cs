using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using PowerLoom.Contracts;
using PowerLoom.GoogleDriveIntegration.Features.Connection.Models;
using PowerLoom.GoogleDriveIntegration.Settings;
using PowerLoom.Infrastructure.Http;
using PowerLoom.Infrastructure.Vaults;
using PowerLoom.Persistence;
using Wolverine.Http;

namespace PowerLoom.GoogleDriveIntegration.Features.Connection;

// Settings → Data access → Google Drive (user decision 2026-10-25). Which agents may read it is each agent's own switch
// (the `readGoogleDrive` integration in its Config).
public static class GoogleDriveEndpoints
{
    public static Task<ProblemDetails> ValidateAsync(string vault, PowerLoomDbContext db, CancellationToken cancellation) => VaultChecks.NotAVaultAsync(vault, db, cancellation);

    [WolverinePut("/api/vaults/{vault}/google-drive")]
    public static async Task<Results<Ok<GoogleDriveSummary>, ProblemHttpResult>> Save(string vault, SaveGoogleDriveRequest request, GoogleDriveConnection connection, CancellationToken cancellation)
    {
        return Summary(await connection.SaveAsync(vault, request, cancellation));
    }

    [WolverinePost("/api/vaults/{vault}/google-drive/sign-in")]
    public static async Task<Results<Ok<GoogleDriveSummary>, ProblemHttpResult>> SignIn(string vault, GoogleSignInRequest request, GoogleDriveConnection connection, CancellationToken cancellation)
    {
        return Summary(await connection.SignInAsync(vault, request, cancellation));
    }

    [WolverineDelete("/api/vaults/{vault}/google-drive/sign-in")]
    public static async Task<Ok<GoogleDriveSummary>> SignOut(string vault, [FromServices] GoogleDriveConnection connection, CancellationToken cancellation)
    {
        return TypedResults.Ok(GoogleDriveConnection.SummaryOf(await connection.SignOutAsync(vault, cancellation)));
    }

    [WolverinePost("/api/vaults/{vault}/google-drive/folders")]
    public static async Task<Results<Ok<GoogleDriveSummary>, ProblemHttpResult>> AddFolder(string vault, AddGoogleDriveFolderRequest request, GoogleDriveConnection connection, CancellationToken cancellation)
    {
        return Summary(await connection.AddFolderAsync(vault, request, cancellation));
    }

    [WolverineDelete("/api/vaults/{vault}/google-drive/folders/{id}")]
    public static async Task<Ok<GoogleDriveSummary>> RemoveFolder(string vault, string id, [FromServices] GoogleDriveConnection connection, CancellationToken cancellation)
    {
        return TypedResults.Ok(GoogleDriveConnection.SummaryOf(await connection.RemoveFolderAsync(vault, id, cancellation)));
    }

    private static Results<Ok<GoogleDriveSummary>, ProblemHttpResult> Summary(Outcome<GoogleDriveSettings> outcome)
    {
        return outcome.Ok ? TypedResults.Ok(GoogleDriveConnection.SummaryOf(outcome.Value!)) : outcome.Problem!.ToProblemResult();
    }
}
