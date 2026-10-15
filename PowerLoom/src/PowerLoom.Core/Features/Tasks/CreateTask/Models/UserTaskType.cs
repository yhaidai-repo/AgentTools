using PowerLoom.Persistence.Enums;

namespace PowerLoom.Features.Tasks.CreateTask.Models;

// A task type the user may create and what it needs: a PBI (required, optional or none), and whether a PBI holds only
// one open task of it at a time.
public sealed record UserTaskType(string Name, ItemKind Kind, PbiUse Pbi, bool OnePerPbi);
