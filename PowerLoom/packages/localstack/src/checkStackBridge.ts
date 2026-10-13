import type { StackBridgeCheck } from "./models/StackBridgeCheck";
import type { StackBridgeClient } from "./StackBridgeClient";

// Settings' Test: the catalog call needs the token, so it proves both that the bridge answers and that it accepts it.
export async function checkStackBridge(client: Pick<StackBridgeClient, "services" | "status">): Promise<StackBridgeCheck> {
  const services = await client.services();

  if (!services.ok) {
    return { ok: false, message: services.message };
  }

  const status = await client.status();
  const running = status.ok && status.value.running ? ` A stack is running now (${status.value.phase}).` : "";

  return { ok: true, message: `The bridge answers and accepts the token: ${services.value.length} services can run.${running}` };
}
