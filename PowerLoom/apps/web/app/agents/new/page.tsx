import { AGENT_TASK_TYPES, BLOCKER_KINDS, CREATABLE_TASK_TYPES, newAgentTemplate } from "@powerloom/core";
import { modelCatalog } from "@agenttools/config";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getAgentConfig } from "@/lib/agentConfig";
import { loadSkillCatalog, skillFolders } from "@/lib/skills";
import { AgentForm } from "../[agent]/config/AgentForm";

export const dynamic = "force-dynamic";

const TASK_TYPES = { agent: AGENT_TASK_TYPES, creatable: CREATABLE_TASK_TYPES };

// An agent created in the UI (user decision 2026-10-22): the Config form itself on the template's defaults (user decision
// 2026-10-24), with an id to type. It runs on the generic executor.
export default async function NewAgentPage() {
  return (
    <>
      <Breadcrumbs crumbs={[{ label: "Agents", href: "/agents" }, { label: "New agent" }]} />
      <h1>New agent</h1>
      <AgentForm
        isNew
        agent={await newAgentTemplate(getAgentConfig(), "")}
        removable={false}
        promptFile={null}
        promptVersions={[]}
        catalog={modelCatalog()}
        skills={await loadSkillCatalog()}
        skillFolders={skillFolders()}
        blockerKinds={BLOCKER_KINDS}
        taskTypes={TASK_TYPES}
        spentTodayUsd={0}
      />
    </>
  );
}
