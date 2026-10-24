export interface AzureLoginStatus {
  status: "pending" | "done" | "failed";
  username: string | null;
  error: string | null;
}
