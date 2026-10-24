namespace PowerLoom.Features.Pbis.UserNotes.Models;

// LoadedText is what the page showed before the edit: the save is refused when the vault holds something else.
public sealed record SaveUserNotesRequest(string Text, string LoadedText);
