using System;
using System.Collections.Generic;

using PowerLoom.Persistence.Enums;

namespace PowerLoom.Persistence.Entities;

public partial class ReviewComment
{
    public string Id { get; set; } = null!;

    public int PrId { get; set; }

    public long? RunId { get; set; }

    public string Commit { get; set; } = null!;

    public string FilePath { get; set; } = null!;

    public int StartLine { get; set; }

    public int EndLine { get; set; }

    public string BodyMd { get; set; } = null!;

    public string CodeSnippet { get; set; } = null!;

    public int SnippetStartLine { get; set; }

    public string? AnswerMd { get; set; }

    public DateTime? AnsweredAt { get; set; }

    public string? AgentReplyMd { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public ReviewSeverity Severity { get; set; }

    /// <summary>What the comment is about (business-logic, correctness, style, ...); null for Code review's comments.</summary>
    public string? Category { get; set; }

    public ReviewCommentStatus Status { get; set; }

    public virtual PullRequest Pr { get; set; } = null!;

    public virtual AgentRun? Run { get; set; }
}
