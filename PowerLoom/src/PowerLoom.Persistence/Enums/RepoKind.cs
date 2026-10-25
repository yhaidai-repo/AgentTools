namespace PowerLoom.Persistence.Enums;

// PostgreSQL enum `repo_kind`; the labels are the kebab-case of the member names (KebabCaseNameTranslator).
public enum RepoKind
{
    Ado,
    Local,
    // A GitHub repo (user decision 2026-10-25), listed from GitHub with the vault's token.
    Github,
}
