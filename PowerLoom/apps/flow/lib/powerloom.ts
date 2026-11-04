import { createPowerLoomClient } from "@powerloom/client";

// PowerLoom, the .NET backend: the Flow app's client (POWERLOOM_URL), the one write path of every app (design 2026-11-03).
export const powerloom = createPowerLoomClient(process.env.POWERLOOM_URL);
