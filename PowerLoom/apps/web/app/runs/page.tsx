import { redirect } from "next/navigation";
import { agentsUrl } from "@/lib/agentsUrl";

type Search = Promise<{ agent?: string; range?: string; outcome?: string; run?: string }>;

// Runs is a tab of Agents now (user decision 2026-10-18); old links still land there, a run link on its page.
export default async function RunsPage({ searchParams }: { searchParams: Search }) {
  const { run, ...filters } = await searchParams;

  if (run) {
    redirect(`/agents/runs/${run}`);
  }

  redirect(agentsUrl({ tab: "runs", ...filters }));
}
