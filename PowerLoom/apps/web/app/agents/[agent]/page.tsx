import { redirect } from "next/navigation";
import { agentsUrl } from "@/lib/agentsUrl";

type Params = Promise<{ agent: string }>;
type Search = Promise<{ range?: string; outcome?: string }>;

// An agent's runs are the Agents page's Runs tab filtered to that agent.
export default async function AgentRunsPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { agent } = await params;

  redirect(agentsUrl({ tab: "runs", agent, ...(await searchParams) }));
}
