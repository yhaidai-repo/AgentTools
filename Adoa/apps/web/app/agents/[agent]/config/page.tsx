import { modelCatalog } from "@agenttools/config";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAgentConfig } from "@/lib/agentConfig";
import { AgentForm } from "./AgentForm";

export const dynamic = "force-dynamic";

export default async function AgentConfigPage({ params }: { params: Promise<{ agent: string }> }) {
  const { agent: agentId } = await params;
  const agent = await getAgentConfig().get(agentId);

  if (!agent) {
    notFound();
  }

  return (
    <>
      <h1>Config: {agent.label}</h1>
      <p><Link href="/agents">← All agents</Link> · <Link href={`/agents/${agent.id}`}>Runs</Link></p>
      <AgentForm agent={agent} catalog={modelCatalog()} />
    </>
  );
}
