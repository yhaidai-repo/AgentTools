// The service's settings, from its environment (docker-compose.yml): every container gets the same image and limits.
export interface SandboxConfig {
  token: string;
  port: number;
  /** The Docker API, normally the socket proxy: tcp://host:port. */
  dockerHost: string;
  dockerPort: number;
  image: string;
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
}
