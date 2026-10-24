using Microsoft.Extensions.Options;
using PowerLoom.Contracts;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Settings;

namespace PowerLoom.Infrastructure.ChatLaunch;

// The chosen agent app, or why none can open a chat (the button's reason). The choice is Settings → AI providers' chat
// app (a global `config` row), else CONTINUE_LAUNCHER from .env (`Chat:Launcher`), else Claude Desktop.
public sealed class ChatLaunchers(IEnumerable<IChatLauncher> launchers, IOptions<ChatOptions> options, PowerLoomDbContext db)
{
    // The TypeScript side reads the same key; the value is {"launcher": "<id>"}.
    public const string SettingKey = "chatApp";

    // Every app a chat can open in, in registration order (Settings offers them).
    public IReadOnlyList<IChatLauncher> Registered { get; } = launchers.ToList();

    public async Task<Outcome<IChatLauncher>> CurrentAsync(CancellationToken cancellation)
    {
        var id = await ChosenIdAsync(cancellation);
        var launcher = Find(id);

        if (launcher is null)
            return Outcome<IChatLauncher>.Failure(Problem.Invalid($"Unknown chat launcher \"{id}\"."));

        if (string.IsNullOrWhiteSpace(options.Value.ReposRoot) || string.IsNullOrWhiteSpace(options.Value.BacklogHostRoot))
            return Outcome<IChatLauncher>.Failure(Problem.Invalid("Set VAULTS_ROOT, REPOS_ROOT and VAULT_PATH in .env: the chat needs the PC paths."));

        return Outcome<IChatLauncher>.Success(launcher);
    }

    // "Continue with <label>": the chosen app's name, "agent" when it isn't a registered one.
    public async Task<string> LabelAsync(CancellationToken cancellation) => Find(await ChosenIdAsync(cancellation))?.Label ?? "agent";

    public async Task<string> ChosenIdAsync(CancellationToken cancellation)
    {
        var saved = await GlobalSettings.ReadAsync<ChatAppSetting>(db, SettingKey, cancellation);

        return string.IsNullOrWhiteSpace(saved?.Launcher) ? options.Value.Launcher : saved.Launcher;
    }

    // Only a registered app can be chosen, so a saved choice always opens.
    public async Task<Outcome<IChatLauncher>> ChooseAsync(string id, CancellationToken cancellation)
    {
        var launcher = Find(id);

        if (launcher is null)
            return Outcome<IChatLauncher>.Failure(Problem.Invalid($"Unknown chat app \"{id}\". Choose one of: {string.Join(", ", Registered.Select(candidate => candidate.Id))}."));

        await GlobalSettings.SaveAsync(db, SettingKey, new ChatAppSetting { Launcher = launcher.Id }, cancellation);

        return Outcome<IChatLauncher>.Success(launcher);
    }

    private IChatLauncher? Find(string id) => Registered.SingleOrDefault(candidate => candidate.Id == id);

    private sealed class ChatAppSetting
    {
        public string Launcher { get; set; } = "";
    }
}
