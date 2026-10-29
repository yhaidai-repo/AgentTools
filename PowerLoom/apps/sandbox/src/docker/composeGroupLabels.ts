import type { SandboxContainerRole } from "../models/SandboxContainerRole";

const COMPOSE_PROJECT_LABEL = "com.docker.compose.project";
const COMPOSE_SERVICE_LABEL = "com.docker.compose.service";

// Docker Desktop groups containers by the compose project label, so the service's containers show under its install.
// Only these two labels: compose claims a container (lists it, reports it as an orphan, removes it with
// --remove-orphans) only when it also has com.docker.compose.config-hash and com.docker.compose.oneoff=False.
// `project`: null when the service runs outside compose, and then the containers stay ungrouped.
export function composeGroupLabels(project: string | null, role: SandboxContainerRole): Record<string, string> {
  if (!project) {
    return {};
  }

  return { [COMPOSE_PROJECT_LABEL]: project, [COMPOSE_SERVICE_LABEL]: role };
}
