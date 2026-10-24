
namespace PowerLoom.Features.Tasks.CreateTask.Models;

// A task type the user may create and what it needs: a PBI (required, optional or none), whether a PBI holds only one
// open task of it at a time, and the id prefix of its tasks without a PBI (numbered across the app).
public sealed record UserTaskType(string Name, string Kind, PbiUse Pbi, bool OnePerPbi, string? NoPbiPrefix);
