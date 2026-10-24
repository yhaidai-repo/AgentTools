export interface AzureLoginStatus {
  status: "pending" | "done" | "failed";
  error: string | null;
}
