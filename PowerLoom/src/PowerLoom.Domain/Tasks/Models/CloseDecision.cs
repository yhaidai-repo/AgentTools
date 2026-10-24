namespace PowerLoom.Domain.Tasks.Models;

// How a person closes an item: a question or finding is answered or dismissed, a human task done or cancelled, an
// agent task cancelled.
public enum CloseDecision
{
    Answer,
    Dismiss,
    Done,
    Cancel,
}
