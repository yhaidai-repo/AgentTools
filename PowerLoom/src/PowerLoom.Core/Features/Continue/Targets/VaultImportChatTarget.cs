using PowerLoom.Contracts;
using PowerLoom.Features.Continue.Models;
using PowerLoom.Infrastructure.ChatLaunch;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Vaults;

namespace PowerLoom.Features.Continue.Targets;

// "Import a folder" (user decision 2026-10-25): a desktop chat moves an existing folder of documents into the vault's
// structure with the user at hand, keeps a report of every file (which is also how a new chat resumes an import that
// ran out of room), and ends with a summary of the migrated vault and what it learned the vault is about.
public sealed class VaultImportChatTarget(PowerLoomDbContext db, HostPaths hostPaths, TimeProvider clock) : IChatTarget
{
    private const int BatchSize = 10;

    public ChatKind Kind => ChatKind.Import;

    public Task<Outcome<ChatBrief>> BriefAsync(string id, IChatLauncher launcher, CancellationToken cancellation) =>
        Task.FromResult(Outcome<ChatBrief>.Failure(Problem.Invalid("An import needs the folder to import: its path on the PC.")));

    public async Task<Outcome<ChatBrief>> BriefAsync(OpenChatRequest request, IChatLauncher launcher, CancellationToken cancellation)
    {
        var source = request.Folder?.Trim().TrimEnd('/', '\\');

        if (string.IsNullOrWhiteSpace(source))
            return Outcome<ChatBrief>.Failure(Problem.Invalid("An import needs the folder to import: its path on the PC."));

        if (!await db.VaultExistsAsync(request.Id, cancellation))
            return Outcome<ChatBrief>.Failure(Problem.NotFound($"{request.Id} isn't a vault."));

        return Outcome<ChatBrief>.Success(BriefOf(request.Id, source));
    }

    private ChatBrief BriefOf(string vault, string source)
    {
        var folder = hostPaths.ChatFolder(vault);
        var report = $"{folder}/import-reports/{clock.GetUtcNow():yyyy-MM-dd}-{SlugOf(source)}.md";

        return ChatBrief.For(vault, $"Import {NameOf(source)} into the vault {vault}") with
        {
            ReadFirst = [new ReadFirstLink("AGENTS", $"{folder}/AGENTS.md", "the vault's rules: its structure, notes, registers and drafts"), new ReadFirstLink("index", $"{folder}/index.md", "the vault's projects as they are now")],
            Before = [$"Add {source} to the session to read it (it is outside the vault). Never change or delete anything there."],
            Ending = $"Do the Import steps below with the user. When every file is done or skipped, finish the report ({report}) with its Summary and What this vault is about, tell the user both in a few lines, and ask whether to put the vault's description at the top of index.md.",
            AfterYes = ["After their yes: write a short description of the vault at the top of index.md (what it covers, its projects), as the report's What this vault is about says."],
            Sections = [new ChatSection("Import", ImportSteps(source, report)), new ChatSection("Report", ReportTemplate(source))],
            Rules = [$"Read from {source} only; write only inside the vault's folder ({folder}).", "Follow AGENTS.md for every note: short, its frontmatter, unique names, links that resolve."],
            ExtraFolders = [source],
        };
    }

    private static string ImportSteps(string source, string report) => string.Join("\n", new[]
    {
        $"Inventory: list every file under {source}, subfolders too, and create the report {report} (template under Report) with one row per file. Skip, with the reason in its row: files you can't read, images, archives, source code (Settings → Repositories covers code) and anything that looks like a secret (.env, keys, credentials).",
        "Propose the structure and wait for the user's yes: the projects (`<key>/` with its index and the four registers, AGENTS.md) and features the files belong to, which files become which notes, which merge, and whether to keep the originals of PDF and Office files (in the feature's `attachments/`).",
        $"Migrate in batches of about {BatchSize} files: write or extend the notes as AGENTS.md says, then update each file's row in the report (action, destination, status). The report is the import's progress: if this chat runs out of room, a new import chat continues with the rows not done.",
        "Glossary terms: add them yourself. Known issues and open questions: ask the user first, as AGENTS.md says. Tag every assumption `(assumption)` and list it in the report.",
        "When every row is done or skipped: check the links (no `[[…]]` to a missing note) and add the new projects to index.md's table.",
    }.Select((step, index) => $"{index + 1}. {step}"));

    private string ReportTemplate(string source) => $$"""
        ```markdown
        ---
        title: "Import of {{NameOf(source)}}"
        type: report
        source: "{{source}}"
        captured: {{clock.GetUtcNow():yyyy-MM-dd}}
        ---
        # Import of {{NameOf(source)}}

        | Source file | Kind | Action | Destination | Status |
        |---|---|---|---|---|
        | specs/export.pdf | PDF | merged | [[app-export]] | done |

        ## Assumptions
        ## Open questions
        ## Summary
        Files migrated, merged and skipped; notes created and changed; registers touched; follow-ups.
        ## What this vault is about
        What you learned: its projects and features, the domain and its main terms, the systems and people involved,
        and what is still unclear.
        ```
        """;

    private static string NameOf(string source) => source.Replace('\\', '/').Split('/').Last();

    private static string SlugOf(string source) => string.Concat(NameOf(source).ToLowerInvariant().Select(letter => char.IsLetterOrDigit(letter) ? letter : '-')).Trim('-');
}
