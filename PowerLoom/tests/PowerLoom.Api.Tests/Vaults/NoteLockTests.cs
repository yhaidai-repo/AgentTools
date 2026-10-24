using PowerLoom.Infrastructure.Vaults;

namespace PowerLoom.Api.Tests.Vaults;

public sealed class NoteLockTests : IDisposable
{
    private readonly string folder = Directory.CreateTempSubdirectory("note-lock-").FullName;

    private string Note => Path.Combine(folder, "chatp-known-issues.md");

    [Fact]
    public async Task One_writer_holds_the_lock_and_the_next_gets_it_once_released()
    {
        var first = await NoteLock.TryEnterAsync(Note, CancellationToken.None, TimeSpan.Zero);
        var busy = await NoteLock.TryEnterAsync(Note, CancellationToken.None, TimeSpan.Zero);

        first!.Dispose();
        using var next = await NoteLock.TryEnterAsync(Note, CancellationToken.None, TimeSpan.Zero);

        Assert.Null(busy);
        Assert.NotNull(next);
        Assert.Equal(Path.Combine(folder, ".chatp-known-issues.md.lock"), NoteLock.LockFileOf(Note));
    }

    [Fact]
    public async Task A_lock_left_by_a_killed_writer_is_taken_over_and_a_released_one_leaves_no_file()
    {
        var lockFile = NoteLock.LockFileOf(Note);

        await File.WriteAllTextAsync(lockFile, "");
        File.SetLastWriteTimeUtc(lockFile, DateTime.UtcNow.AddMinutes(-5));

        var taken = await NoteLock.TryEnterAsync(Note, CancellationToken.None, TimeSpan.Zero);

        Assert.NotNull(taken);
        taken.Dispose();
        Assert.False(File.Exists(lockFile));
    }

    public void Dispose() => Directory.Delete(folder, recursive: true);
}
