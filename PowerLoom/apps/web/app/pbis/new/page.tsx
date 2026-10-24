import { ACCEPTED_EXTENSIONS } from "@powerloom/attachments";
import { enabledRepos } from "@powerloom/core";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { NoVault } from "@/components/NoVault";
import { getDb } from "@/lib/db";
import { currentVault } from "@/lib/currentVault";
import { NewPbiForm } from "./NewPbiForm";

export const dynamic = "force-dynamic";

// A PBI created in PowerLoom (user decision 2026-10-06): for a vault without an ADO integration, or for work ADO doesn't
// track. It joins the selected vault's backlog like a synced one.
export default async function NewPbiPage() {
  const vault = await currentVault();

  if (!vault) {
    return <NoVault title="New PBI" />;
  }

  return (
    <>
      <Breadcrumbs crumbs={[{ label: "Backlog", href: "/pbis" }, { label: "New PBI" }]} />
      <h1>New PBI</h1>
      <NewPbiForm vault={vault} repos={(await enabledRepos(getDb(), vault)).map((row) => row.name)} accept={ACCEPTED_EXTENSIONS.join(",")} />
    </>
  );
}
