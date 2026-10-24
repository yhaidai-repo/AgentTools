namespace PowerLoom.Infrastructure.Vaults;

// A note that more than one process reads, changes and writes back (a register: the backend closes records, the
// backend and the runner's agents add them through VaultCapture) is changed under its lock file, `.<note>.lock` next to
// it, the same file VaultCapture's Use-RegisterLock takes. Created only if it isn't there, deleted when done; one older
// than a minute is left over from a killed writer and is taken over.
public sealed class NoteLock : IDisposable
{
    private static readonly TimeSpan Wait = TimeSpan.FromSeconds(15);
    private static readonly TimeSpan Stale = TimeSpan.FromMinutes(1);
    private static readonly TimeSpan Retry = TimeSpan.FromMilliseconds(100);

    private readonly string lockFile;

    private NoteLock(string lockFile) => this.lockFile = lockFile;

    // Null when another writer still holds it after the wait.
    public static async Task<NoteLock?> TryEnterAsync(string note, CancellationToken cancellation, TimeSpan? wait = null)
    {
        var lockFile = LockFileOf(note);
        var deadline = DateTime.UtcNow + (wait ?? Wait);

        while (!TryCreate(lockFile))
        {
            if (RemovedStale(lockFile))
                continue;

            if (DateTime.UtcNow > deadline)
                return null;

            await Task.Delay(Retry, cancellation);
        }

        return new NoteLock(lockFile);
    }

    public static string LockFileOf(string note) => Path.Combine(Path.GetDirectoryName(note)!, $".{Path.GetFileName(note)}.lock");

    public void Dispose() => File.Delete(lockFile);

    private static bool TryCreate(string lockFile)
    {
        try
        {
            using var created = new FileStream(lockFile, FileMode.CreateNew, FileAccess.Write, FileShare.None);

            return true;
        }
        catch (IOException) when (File.Exists(lockFile))
        {
            return false;
        }
    }

    private static bool RemovedStale(string lockFile)
    {
        var stale = File.Exists(lockFile) && File.GetLastWriteTimeUtc(lockFile) < DateTime.UtcNow - Stale;

        if (stale)
            File.Delete(lockFile);

        return stale;
    }
}
