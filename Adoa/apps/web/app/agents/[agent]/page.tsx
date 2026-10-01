import { redirect } from "next/navigation";

type Params = Promise<{ agent: string }>;
type Search = Promise<{ range?: string; outcome?: string }>;

// An agent's runs are the Runs page filtered to that agent.
export default async function AgentRunsPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { agent } = await params;
  const query = new URLSearchParams({ agent, ...(await searchParams) });

  redirect(`/runs?${query}`);
}
