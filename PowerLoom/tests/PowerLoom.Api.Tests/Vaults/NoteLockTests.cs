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
    public async Task An_unowned_file_is_immediately_reusable_and_keeps_the_shared_inode()
    {
        var lockFile = NoteLock.LockFileOf(Note);

        await File.WriteAllTextAsync(lockFile, "");
        File.SetLastWriteTimeUtc(lockFile, DateTime.UtcNow.AddMinutes(-5));

        var taken = await NoteLock.TryEnterAsync(Note, CancellationToken.None, TimeSpan.Zero);

        Assert.NotNull(taken);
        taken.Dispose();
        Assert.True(File.Exists(lockFile));
        using var next = await NoteLock.TryEnterAsync(Note, CancellationToken.None, TimeSpan.Zero);
        Assert.NotNull(next);
    }

    [Fact]
    public async Task Releasing_an_old_owner_twice_does_not_release_its_replacement()
    {
        var first = await NoteLock.TryEnterAsync(Note, CancellationToken.None, TimeSpan.Zero);
        first!.Dispose();
        using var next = await NoteLock.TryEnterAsync(Note, CancellationToken.None, TimeSpan.Zero);
        first.Dispose();
        using var busy = await NoteLock.TryEnterAsync(Note, CancellationToken.None, TimeSpan.Zero);
        Assert.NotNull(next);
        Assert.Null(busy);
    }

    [Fact]
    public async Task Waiting_for_a_live_owner_can_be_cancelled()
    {
        using var first = await NoteLock.TryEnterAsync(Note, CancellationToken.None, TimeSpan.Zero);
        using var cancellation = new CancellationTokenSource(TimeSpan.FromMilliseconds(50));
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => NoteLock.TryEnterAsync(Note, cancellation.Token));
        using var busy = await NoteLock.TryEnterAsync(Note, CancellationToken.None, TimeSpan.Zero);
        Assert.Null(busy);
    }

    public void Dispose() => Directory.Delete(folder, recursive: true);
}
