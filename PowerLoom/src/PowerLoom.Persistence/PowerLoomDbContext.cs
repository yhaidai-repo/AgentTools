using Microsoft.EntityFrameworkCore;
using PowerLoom.Persistence.Entities;

namespace PowerLoom.Persistence;

public partial class PowerLoomDbContext : DbContext
{
    public PowerLoomDbContext(DbContextOptions<PowerLoomDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<AdoStateChange> AdoStateChanges { get; set; }

    public virtual DbSet<AgentRun> AgentRuns { get; set; }

    public virtual DbSet<Attachment> Attachments { get; set; }

    public virtual DbSet<Bug> Bugs { get; set; }

    public virtual DbSet<CodeReview> CodeReviews { get; set; }

    public virtual DbSet<Config> Configs { get; set; }

    public virtual DbSet<DeletedPbi> DeletedPbis { get; set; }

    public virtual DbSet<DeletedPullRequest> DeletedPullRequests { get; set; }

    public virtual DbSet<Design> Designs { get; set; }

    public virtual DbSet<LocalItem> LocalItems { get; set; }

    public virtual DbSet<PbiEstimate> PbiEstimates { get; set; }

    public virtual DbSet<PbiFeedback> PbiFeedbacks { get; set; }

    public virtual DbSet<PbiImport> PbiImports { get; set; }

    public virtual DbSet<PbiRepo> PbiRepos { get; set; }

    public virtual DbSet<PullRequest> PullRequests { get; set; }

    public virtual DbSet<Refinement> Refinements { get; set; }

    public virtual DbSet<Repo> Repos { get; set; }

    public virtual DbSet<ReviewComment> ReviewComments { get; set; }

    public virtual DbSet<SkillRevision> SkillRevisions { get; set; }

    public virtual DbSet<SprintSnapshot> SprintSnapshots { get; set; }

    public virtual DbSet<StatusHistory> StatusHistories { get; set; }

    public virtual DbSet<TaskSchedule> TaskSchedules { get; set; }

    public virtual DbSet<Vault> Vaults { get; set; }

    public virtual DbSet<VaultCapture> VaultCaptures { get; set; }

    public virtual DbSet<VaultNoteWrite> VaultNoteWrites { get; set; }

    public virtual DbSet<DataAccess> DataAccesses { get; set; }

    public virtual DbSet<TestCase> TestCases { get; set; }

    public virtual DbSet<VaultReviewDecision> VaultReviewDecisions { get; set; }

    public virtual DbSet<WorkItem> WorkItems { get; set; }

    public virtual DbSet<WwwRecord> WwwRecords { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // The PostgreSQL enums come from MapPowerLoomEnums (Npgsql registers them with the model).
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(PowerLoomDbContext).Assembly);
        modelBuilder.HasSequence("local_pbi_id").StartsAt(9000001L);
        modelBuilder.HasSequence("local_pr_id").StartsAt(9000001L);

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
