import { BLOCKER_KINDS } from "@adoa/core";
import { modelCatalog } from "@agenttools/config";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAgentConfig } from "@/lib/agentConfig";
import { spentToday } from "@/lib/budgetUsage";
import { loadSkillCatalog, skillFolders } from "@/lib/skills";
import { AgentForm } from "./AgentForm";

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
        agentIds={(await store.list()).map((entry) => entry.id)}
        blockerKinds={BLOCKER_KINDS}
        spentTodayUsd={await spentToday({ agent: agent.id })}
      />
    </>
  );
}
