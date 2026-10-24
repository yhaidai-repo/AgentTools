import type { AzureResourceKind, AzureUserAccount } from "@powerloom/core";
import type { AzureResourceRow } from "@/models/AzureResourceRow";
import { AddAzureResourceForm } from "./AddAzureResourceForm";
import { AzureResourceRowForm } from "./AzureResourceRowForm";
import { AzureSubscriptionForm } from "./AzureSubscriptionForm";
import { AzureUserLoginForm } from "./AzureUserLoginForm";
import { ReadAzureSwitchForm } from "./ReadAzureSwitchForm";

interface KindText {
  title: string;
  help: string;
}

// Azure access = the Azure MCP server's read tools; Cosmos DB and Mongo keep an allow-list of accounts (user decision
// 2026-10-14). Everything is read with the one sign-in below. One card per kind, its switch in the head.
const KINDS: Record<AzureResourceKind, KindText> = {
  azureAccess: {
    title: "Azure",
    help: "Reads Azure as you through Microsoft's Azure MCP Server: App Insights and Log Analytics queries, metrics, activity logs, queue and topic counts, resource groups. Tools that would return keys or settings are never offered.",
  },
  cosmos: {
    title: "Cosmos DB",
    help: "Each account is read with its read-only key, fetched with your sign-in at call time; nothing is stored here.",
  },
  mongo: {
    title: "Mongo",
    help: "Cosmos DB for MongoDB accounts (connection string fetched with your sign-in at call time), or any Mongo server by its connection string, stored and never shown again. Writes are refused; a read-only user is the real barrier.",
  },
  serviceBus: {
    title: "Service Bus",
    help: "Peeks messages with a Listen-only policy's connection string, stored and never shown again; messages stay in place. Counts come with Azure access.",
  },
};

export function ReadAzurePanel({ enabledKinds, account, subscription, resources }: { enabledKinds: Partial<Record<AzureResourceKind, boolean>>; account: AzureUserAccount | null; subscription: string; resources: AzureResourceRow[] }) {
  return (
    <>
      {(Object.keys(KINDS) as AzureResourceKind[]).map((kind) => (
        <KindCard key={kind} kind={kind} enabled={enabledKinds[kind] === true} account={account} subscription={subscription} resources={resources.filter((row) => row.kind === kind)} />
      ))}
    </>
  );
}

function KindCard({ kind, enabled, account, subscription, resources }: { kind: AzureResourceKind; enabled: boolean; account: AzureUserAccount | null; subscription: string; resources: AzureResourceRow[] }) {
  const text = KINDS[kind];

  return (
    <section className="panel settings-card">
      <ReadAzureSwitchForm kind={kind} title={text.title} help={text.help} enabled={enabled} />
      <div className="settings-body">
        {kind === "azureAccess" ? <AccessSection account={account} subscription={subscription} /> : <ResourcesSection kind={kind} resources={resources} />}
      </div>
    </section>
  );
}

function AccessSection({ account, subscription }: { account: AzureUserAccount | null; subscription: string }) {
  return (
    <>
      <AzureUserLoginForm account={account} />
      <AzureSubscriptionForm subscription={subscription} />
    </>
  );
}

function ResourcesSection({ kind, resources }: { kind: AzureResourceKind; resources: AzureResourceRow[] }) {
  return (
    <>
      {resources.length === 0 ? <p className="hint">Nothing added yet.</p> : resources.map((row) => <AzureResourceRowForm key={row.name} resource={row} />)}
      <AddAzureResourceForm kind={kind} />
    </>
  );
}
