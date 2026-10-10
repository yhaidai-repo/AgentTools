namespace PowerLoom.Domain.Tasks.Models;

// How a person closes a human item: a question or finding is answered or dismissed, a human task done or cancelled.
public enum CloseDecision
{
    Answer,
    Dismiss,
    Done,
    Cancel,
}
