namespace PowerLoom.Persistence.Enums;

// PostgreSQL enum `attachment_origin`; the labels are the kebab-case of the member names (KebabCaseNameTranslator).
public enum AttachmentOrigin
{
    Upload,
    Ado,
    Confluence,
    // Notes an agent with web access saved on a linked web page (user decision 2026-10-14).
    Agent,
}
