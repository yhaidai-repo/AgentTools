// The service's settings, from its environment (docker-compose.yml): every container gets the same image and limits.
export interface SandboxConfig {
  token: string;
  port: number;
  /** The Docker API, normally the socket proxy: tcp://host:port. */
  dockerHost: string;
  dockerPort: number;
  /** A Docker runtime such as runsc (gVisor); null = Docker's default. */
  runtime: string | null;
  cpus: number;
  memoryMb: number;
  pidsLimit: number;
  /** The workspace's size cap: commands are refused once it is passed. */
  diskMb: number;
  tmpMb: number;
  maxCommandMs: number;
  maxSessions: number;
  /** The internal network restore containers join; its only way out is the egress proxy. Null = no restores. */
  egressNetwork: string | null;
  /** The egress proxy as the restore containers reach it, e.g. http://sandbox-egress:3128. */
  proxyUrl: string;
  restoreTimeoutMs: number;
  /** Shared with the egress proxy: signs each restore's pass with its vault's hosts. Null = the proxy's fixed list. */
  proxySecret: string | null;
  /** sandbox-images.json, the images a vault may pick; null = the general image only. */
  imageCatalogPath: string | null;
  /** The compose project the service runs in, put on its containers so they group with it; null = outside compose. */
  composeProject: string | null;
}
