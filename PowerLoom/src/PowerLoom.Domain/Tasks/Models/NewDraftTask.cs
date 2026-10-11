namespace PowerLoom.Domain.Tasks.Models;

// A vault draft as the drafts scan hands it to the tech-writer: `Path` relative to the vault.
public sealed record NewDraftTask(string Name, string Title, string Project, string Captured, string Source, string Target, string Path);
