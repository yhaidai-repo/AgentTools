import { isPaused, type AgentsGlobal } from "@agenttools/config";
import { NoVault } from "@/components/NoVault";
import { RememberFilters } from "@/components/RememberFilters";
import { TimeUntil } from "@/components/TimeUntil";
import { getAgentConfig } from "@/lib/agentConfig";
import { currentVault } from "@/lib/currentVault";
import { rememberedParams } from "@/lib/rememberedFilters";
import { PauseSwitch, ResumeButton } from "./AgentControls";
import { AGENTS_TABS, AgentsTabs, DEFAULT_AGENTS_TAB } from "./AgentsTabs";
import { OverviewTab } from "./OverviewTab";
import { RunsTab } from "./RunsTab";
import { ToolsTab } from "./ToolsTab";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | undefined>>;

// Three tabs (user decisions 2026-10-13 and 2026-10-18): Overview (the agents, their runs and costs), Runs (every run,
// once a page of its own) and Tools (what they read outside). Pausing every agent is the page head's switch.
export default async function AgentsPage({ searchParams }: { searchParams: SearchParams }) {
  const vault = await currentVault();

  if (!vault) {
    return <NoVault title="Agents" />;
  }

  const params = await rememberedParams("/agents", await searchParams);
  const tab = AGENTS_TABS.find((choice) => choice.key === params.tab)?.key ?? DEFAULT_AGENTS_TAB;
  const global = await getAgentConfig().getGlobal();
  const tabs = <AgentsTabs active={tab} />;

  return (
    <>
      <div className="page-head">
        <h1>Agents</h1>
        <PauseSwitch isPaused={isPaused(global)} />
      </div>
      <RememberFilters />
      <PauseBanner global={global} />
      {tab === "overview" && <OverviewTab vault={vault} params={params} tabs={tabs} paused={isPaused(global)} />}
      {tab === "runs" && <RunsTab vault={vault} params={params} tabs={tabs} />}
      {tab === "tools" && <ToolsTab vault={vault} params={params} tabs={tabs} />}
    </>
  );
}

// Paused by you, or by the rate limit until a moment: an amber breathing note, never red text (user decision 2026-10-18).
function PauseBanner({ global }: { global: AgentsGlobal }) {
  if (global.paused) {
    return <div className="pause-banner"><span className="dot warn" /><span className="banner-what"><b>All agents are paused.</b> Nothing new starts; runs already going finish.</span><ResumeButton /></div>;
  }

  const until = global.pausedUntil ? new Date(global.pausedUntil) : null;

  return until && until > new Date() ? <div className="pause-banner"><span className="dot warn" /><span className="banner-what"><b>Rate limited:</b> agents start again <TimeUntil date={until} />.</span></div> : null;
}
