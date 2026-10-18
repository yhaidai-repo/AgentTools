import { AGENT_TASK_TYPES, BLOCKER_KINDS, CREATABLE_TASK_TYPES } from "@powerloom/core";
import { isPaused, modelCatalog } from "@agenttools/config";
import { notFound } from "next/navigation";
import { NoVault } from "@/components/NoVault";
import { getAgentConfig } from "@/lib/agentConfig";
import { loadAgentTotals } from "@/lib/agentTotals";
import { spentToday } from "@/lib/budgetUsage";
import { currentVault } from "@/lib/currentVault";
import { fixedPeriodStart } from "@/lib/ranges";
import { loadRunCounts } from "@/lib/runCounts";
import { loadSkillCatalog, skillFolders } from "@/lib/skills";
import { AgentForm } from "./AgentForm";
import { AgentHeader } from "./AgentHeader";

// From core on the server: the form is a client component, and core pulls in the database driver.
const TASK_TYPES = { agent: AGENT_TASK_TYPES, creatable: CREATABLE_TASK_TYPES };
// The header's period: long enough to say how the agent does (user decision 2026-10-18).
const HEADER_RANGE = "30d";

export const dynamic = "force-dynamic";

export default async function AgentConfigPage({ params }: { params: Promise<{ agent: string }> }) {
  const vault = await currentVault();

  if (!vault) {
    return <NoVault title="Agents" />;
  }

  const { agent: agentId } = await params;
  const store = getAgentConfig();
  const agent = await store.get(agentId);

  if (!agent) {
    notFound();
  }

  const since = fixedPeriodStart(HEADER_RANGE, new Date());
  const agents = await store.list();
  const spent = await spentToday({ agent: agent.id });

  return (
    <>
      <AgentHeader
        agent={agent}
        slot={agents.findIndex((candidate) => candidate.id === agent.id)}
        totals={(await loadAgentTotals(since, vault)).get(agent.id)}
        counts={(await loadRunCounts(since, vault)).get(agent.id)}
        spentTodayUsd={spent}
        paused={isPaused(await store.getGlobal())}
      />
      <AgentForm
        agent={agent}
        catalog={modelCatalog()}
        skills={await loadSkillCatalog()}
        skillFolders={skillFolders()}
        blockerKinds={BLOCKER_KINDS}
        taskTypes={TASK_TYPES}
        spentTodayUsd={spent}
      />
    </>
  );
}
