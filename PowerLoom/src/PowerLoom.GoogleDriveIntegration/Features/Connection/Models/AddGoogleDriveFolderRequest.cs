namespace PowerLoom.GoogleDriveIntegration.Features.Connection.Models;

// A folder's link (…/drive/folders/<id>) or id; a shared drive's link works too.
public sealed record AddGoogleDriveFolderRequest(string Folder);
