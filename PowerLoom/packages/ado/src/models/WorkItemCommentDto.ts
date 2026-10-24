export interface WorkItemCommentDto {
  text?: string;
  createdDate?: string;
  createdBy?: { uniqueName?: string; displayName?: string };
}
