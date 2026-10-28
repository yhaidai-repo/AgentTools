// The work that created or changed a maintenance record. Unknown ids are left absent.
export interface RecordWorkContext {
  pbiId?: number;
  taskId?: string;
  chatId?: string;
  sessionId?: string;
}

export interface RecordWorkReference extends RecordWorkContext {
  action: "created" | "updated";
  date?: string;
}
