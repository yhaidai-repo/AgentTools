import { EgressProxy } from "./EgressProxy";
import { fixedAllowlist, signedAllowlist } from "./requestAllowlist";

// The egress proxy (compose service sandbox-egress): the only route out of the restore containers' internal network.
const DEFAULT_HOSTS = "api.nuget.org,registry.npmjs.org";

// SANDBOX_PROXY_SECRET (shared with the sandbox service): each restore brings its vault's hosts in a signed pass.
const secret = process.env.SANDBOX_PROXY_SECRET;
const port = Number(process.env.SANDBOX_PROXY_PORT ?? "3128");
const proxy = new EgressProxy(secret ? signedAllowlist(secret) : fixedAllowlist(process.env.SANDBOX_PACKAGE_HOSTS || DEFAULT_HOSTS));

proxy.listen(port);
console.log(`egress proxy started on ${port}; hosts ${secret ? "from each restore's signed pass" : "from SANDBOX_PACKAGE_HOSTS"}`);

process.once("SIGTERM", stop);
process.once("SIGINT", stop);

async function stop(): Promise<void> {
  await proxy.close();
  process.exit(0);
}
