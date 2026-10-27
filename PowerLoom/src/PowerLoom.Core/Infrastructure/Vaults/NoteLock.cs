namespace PowerLoom.Infrastructure.Vaults;

// A note that more than one process reads, changes and writes back (a register: the backend closes records, the
// backend and the runner's agents add them through VaultCapture) is changed under its lock file, `.<note>.lock` next to
// it, the same file VaultCapture's Use-RegisterLock takes. Keep the exclusive handle for the entire operation, and
// never unlink the shared inode. Process death releases ownership; elapsed time does not establish owner death.
public sealed class NoteLock : IDisposable
{
    private static readonly TimeSpan Wait = TimeSpan.FromSeconds(15);
    private static readonly TimeSpan Retry = TimeSpan.FromMilliseconds(100);

    private readonly FileStream handle;

    private NoteLock(FileStream handle) => this.handle = handle;

    // Null when another writer still holds it after the wait.
    public static async Task<NoteLock?> TryEnterAsync(string note, CancellationToken cancellation, TimeSpan? wait = null)
    {
        var lockFile = LockFileOf(note);
        var deadline = DateTime.UtcNow + (wait ?? Wait);

        while (true)
        {
            cancellation.ThrowIfCancellationRequested();
            var handle = TryOpen(lockFile);
            if (handle is not null)
                return new NoteLock(handle);

            if (DateTime.UtcNow > deadline)
                return null;

            await Task.Delay(Retry, cancellation);
        }
    }

    public static string LockFileOf(string note) => Path.Combine(Path.GetDirectoryName(note)!, $".{Path.GetFileName(note)}.lock");

    public void Dispose() => handle.Dispose();

    private static FileStream? TryOpen(string lockFile)
    {
        try
        {
            return new FileStream(lockFile, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
        }
        catch (IOException) when (File.Exists(lockFile))
        {
            return null;
        }
    }
}
