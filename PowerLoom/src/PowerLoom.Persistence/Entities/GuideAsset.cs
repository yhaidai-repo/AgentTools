namespace PowerLoom.Persistence.Entities;
public sealed class GuideAsset
{
    public Guid Id { get; set; }
    public string TaskId { get; set; } = null!;
    public string Vault { get; set; } = null!;
    public string Name { get; set; } = null!;
    public string Sha256 { get; set; } = null!;
    public byte[] Content { get; set; } = [];
    public DateTime CreatedAt { get; set; }
}
