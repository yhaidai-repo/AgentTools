// One runnable service of DevHub's catalog (DevSecrets services.json). configurable: what a start's config may set
// for it ("workers" for the background host); empty for a service that takes none.
export interface StackServiceInfo {
  name: string;
  note: string | null;
  localUrl: string | null;
  consumesBus: boolean;
  configurable: string[];
}
