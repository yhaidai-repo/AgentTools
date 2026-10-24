import { BLOCKER_KINDS, newAgentTemplate } from "@powerloom/core";
import { taskTypeChoices } from "@/lib/taskTypes";
import { modelCatalog } from "@agenttools/config";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getAgentConfig } from "@/lib/agentConfig";
import { loadSkillCatalog, skillFolders } from "@/lib/skills";
import { AgentForm } from "../[agent]/config/AgentForm";

export const dynamic = "force-dynamic";

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
        taskTypes={await taskTypeChoices()}
        spentTodayUsd={0}
      />
    </>
  );
}
