import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getAgentConfig } from "@/lib/agentConfig";
import { NewAgentForm } from "./NewAgentForm";

export const dynamic = "force-dynamic";

// An agent created in the UI (user decision 2026-10-22): a copy of an existing agent's settings under a new id, with or
// without its prompt and skills, disabled until configured. It runs on the generic executor with its own prompt.
export default async function NewAgentPage() {
  const agents = await getAgentConfig().list();

  return (
    <>
      <Breadcrumbs crumbs={[{ label: "Agents", href: "/agents" }, { label: "New agent" }]} />
      <h1>New agent</h1>
      <NewAgentForm agents={agents.map((agent) => ({ id: agent.id, label: agent.label, description: agent.description }))} />
    </>
  );
}
