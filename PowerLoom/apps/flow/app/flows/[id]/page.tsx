import { FlowEditor } from "@/components/FlowEditor";
import { loadAgentPalette } from "@/lib/agents";

// The agents come from the DB at request time (server component); the flow itself lives in the browser.
export const dynamic = "force-dynamic";

export default async function FlowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const palette = await loadAgentPalette();

  return <FlowEditor flowId={id} palette={palette} />;
}
