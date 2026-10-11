namespace PowerLoom.Infrastructure.Skills;

public sealed class SkillsOptions
{
    public const string Section = "Skills";

    // The skill folders in the order the agent-runner searches them (SKILL_FOLDERS): the first folder with
    // `<name>/SKILL.md` wins.
    public List<string> Folders { get; set; } = [];

    // The only folder PowerLoom may write: its own skills, mounted from the repo (user decision 2026-10-01).
    public string Editable { get; set; } = "";
}
