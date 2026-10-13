// One runnable service of DevHub's catalog (DevSecrets services.json).
export interface StackServiceInfo {
  name: string;
  note: string | null;
  localUrl: string | null;
  consumesBus: boolean;
}
