import type { DevHubCheck } from "./models/DevHubCheck";
import type { DevHubClient } from "./DevHubClient";

// Settings' Test: the catalog call needs the token, so it proves both that DevHub answers and that it accepts it.
export async function checkDevHub(client: Pick<DevHubClient, "services" | "status">): Promise<DevHubCheck> {
  const services = await client.services();

  if (!services.ok) {
    return { ok: false, message: services.message };
  }

  const status = await client.status();
  const running = status.ok && status.value.running ? ` A stack is running now (${status.value.phase}).` : "";

  return { ok: true, message: `DevHub answers and accepts the token: ${services.value.length} services can run.${running}` };
}
