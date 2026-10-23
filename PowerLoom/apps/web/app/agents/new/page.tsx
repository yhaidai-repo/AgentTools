import { AGENT_TASK_TYPES } from "@powerloom/core";
import { modelCatalog } from "@agenttools/config";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { newAgentTemplate } from "@powerloom/core";
import { getAgentConfig } from "@/lib/agentConfig";
import { loadSkillCatalog } from "@/lib/skills";
import { NewAgentForm } from "./NewAgentForm";

export const dynamic = "force-dynamic";

// An agent created in the UI (user decision 2026-10-22, reshaped 2026-10-23): its prompt, skills and task types, with
// defaults for the rest; disabled until configured. It runs on the generic executor.
export default async function NewAgentPage() {
  return (
    <>
      <Breadcrumbs crumbs={[{ label: "Agents", href: "/agents" }, { label: "New agent" }]} />
      <h1>New agent</h1>
      <NewAgentForm template={await newAgentTemplate(getAgentConfig(), "new-agent")} catalog={modelCatalog()} skills={await loadSkillCatalog()} taskTypes={AGENT_TASK_TYPES} />
    </>
  );
}
