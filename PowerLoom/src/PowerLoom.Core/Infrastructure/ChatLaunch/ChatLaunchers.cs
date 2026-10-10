using Microsoft.Extensions.Options;
using PowerLoom.Contracts;

namespace PowerLoom.Infrastructure.ChatLaunch;

// The configured agent app, or why none can open a chat (the button's reason).
public sealed class ChatLaunchers(IEnumerable<IChatLauncher> launchers, IOptions<ChatOptions> options)
{
    public Outcome<IChatLauncher> Current()
    {
        var id = options.Value.Launcher;
        var launcher = launchers.SingleOrDefault(candidate => candidate.Id == id);

        if (launcher is null)
            return Outcome<IChatLauncher>.Failure(Problem.Invalid($"Unknown chat launcher \"{id}\"."));

        if (string.IsNullOrWhiteSpace(options.Value.ReposRoot) || string.IsNullOrWhiteSpace(options.Value.BacklogHostRoot))
            return Outcome<IChatLauncher>.Failure(Problem.Invalid("Set VAULTS_ROOT, REPOS_ROOT and VAULT_PATH in .env: the chat needs the PC paths."));

        return Outcome<IChatLauncher>.Success(launcher);
    }

    // "Continue with <label>": the configured app's name, "agent" when none is configured.
    public string Label() => launchers.SingleOrDefault(candidate => candidate.Id == options.Value.Launcher)?.Label ?? "agent";
}
