import { EgressProxy } from "./EgressProxy";
import { HostAllowlist } from "./HostAllowlist";

// The egress proxy (compose service sandbox-egress): the only route out of the restore containers' internal network.
const DEFAULT_HOSTS = "api.nuget.org,registry.npmjs.org";

const allowlist = HostAllowlist.fromList(process.env.SANDBOX_PACKAGE_HOSTS || DEFAULT_HOSTS);
const port = Number(process.env.SANDBOX_PROXY_PORT ?? "3128");
const proxy = new EgressProxy(allowlist);

proxy.listen(port);
console.log(`egress proxy started on ${port}; ${allowlist.size} allowed host entries`);

process.once("SIGTERM", stop);
process.once("SIGINT", stop);

async function stop(): Promise<void> {
  await proxy.close();
  process.exit(0);
}
