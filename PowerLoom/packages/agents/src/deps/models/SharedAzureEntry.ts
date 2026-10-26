// One vault's shared server: the start options it was started with (compared as text) and its start, so a caller that
// arrives while it is still starting waits for the same one.
export interface SharedAzureEntry<TServer> {
  key: string;
  server: Promise<TServer>;
}
