import { AGENT_TASK_TYPES, BLOCKER_KINDS, CREATABLE_TASK_TYPES, PIPELINE_TASK_TYPES } from "@powerloom/core";
import { modelCatalog } from "@agenttools/config";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAgentConfig } from "@/lib/agentConfig";
import { spentToday } from "@/lib/budgetUsage";
import { loadSkillCatalog, skillFolders } from "@/lib/skills";
import { AgentForm } from "./AgentForm";

// From core on the server: the form is a client component, and core pulls in the database driver.
const TASK_TYPES = { agent: AGENT_TASK_TYPES, creatable: CREATABLE_TASK_TYPES, pipeline: PIPELINE_TASK_TYPES };

export const dynamic = "force-dynamic";

export default async function AgentConfigPage({ params }: { params: Promise<{ agent: string }> }) {
  const { agent: agentId } = await params;
  const store = getAgentConfig();
  const agent = await store.get(agentId);

  if (!agent) {
    notFound();
  }

  return (
    <>
      <h1>Config: {agent.label}</h1>
      <p><Link href="/agents">← All agents</Link> · <Link href={`/agents/${agent.id}`}>Runs</Link></p>
      <AgentForm
        agent={agent}
        catalog={modelCatalog()}
        skills={await loadSkillCatalog()}
        skillFolders={skillFolders()}
        blockerKinds={BLOCKER_KINDS}
        taskTypes={TASK_TYPES}
        spentTodayUsd={await spentToday({ agent: agent.id })}
      />
    </>
  );
}
