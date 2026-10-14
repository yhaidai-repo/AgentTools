export interface PrThreadDto {
  id: number;
  status?: string;
  isDeleted?: boolean;
  threadContext?: {
    filePath?: string;
    rightFileStart?: { line: number };
    rightFileEnd?: { line: number };
    leftFileStart?: { line: number };
    leftFileEnd?: { line: number };
  } | null;
  comments?: {
    id: number;
    parentCommentId?: number;
    content?: string;
    commentType?: string;
    isDeleted?: boolean;
    publishedDate?: string;
    author?: { uniqueName?: string; displayName?: string };
  }[];
}
