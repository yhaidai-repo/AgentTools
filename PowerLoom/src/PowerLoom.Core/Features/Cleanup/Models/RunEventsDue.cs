namespace PowerLoom.Features.Cleanup.Models;

// What the run-event query counts: the rows past the buffer and their size.
public sealed record RunEventsDue(int Rows, long Bytes);
