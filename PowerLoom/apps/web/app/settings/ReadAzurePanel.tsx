import Link from "next/link";
import type { AzureResourceKind, AzureUserAccount } from "@powerloom/core";
import type { AzureResourceRow } from "@/models/AzureResourceRow";
import { AddAzureResourceForm } from "./AddAzureResourceForm";
import { AzureResourceRowForm } from "./AzureResourceRowForm";
import { AzureSubscriptionForm } from "./AzureSubscriptionForm";
import { AzureUserLoginForm } from "./AzureUserLoginForm";
import { ReadAzureSwitchForm } from "./ReadAzureSwitchForm";

interface KindText {
  title: string;
  switchLabel: string;
  help: string;
}

// Azure access = the Azure MCP server's read tools; Cosmos DB and Mongo keep an allow-list of accounts (user decision
// 2026-10-14). Everything is read with the one sign-in below.
const KINDS: Record<AzureResourceKind, KindText> = {
  azureAccess: {
    title: "Azure access",
    switchLabel: "Enabled: agents with the Azure access switch on may read Azure as you, through Microsoft's Azure MCP Server (read-only)",
    help: "App Insights and Log Analytics queries, metrics and activity logs, Service Bus queue and topic counts, resource groups and subscriptions: whatever your account sees. Tools that would return keys or settings are never offered.",
  },
  cosmos: {
    title: "Cosmos DB",
    switchLabel: "Enabled: agents with the Cosmos DB switch on may list and query the accounts below",
    help: "Each account is read with its read-only key, fetched with your sign-in at call time; nothing is stored here. Add only accounts whose documents may leave this PC.",
  },
  mongo: {
    title: "Mongo",
    switchLabel: "Enabled: agents with the Mongo switch on may find documents in the accounts below",
    help: "Cosmos DB for MongoDB accounts, read with the read-only connection string fetched with your sign-in at call time (nothing stored), or any other Mongo server by its connection string, stored here and never shown again. Agents list, find and aggregate; writes are refused, and a read-only user is the real barrier.",
  },
  serviceBus: {
    title: "Service Bus",
    switchLabel: "Enabled: agents with the Service Bus switch on may peek messages in the namespaces below",
    help: "Each namespace is read with the connection string of a shared access policy with Listen only, stored here and never shown again. Agents only peek: messages stay in place. Counts come with Azure access.",
  },
};

export function ReadAzurePanel({ enabledKinds, account, subscription, resources }: { enabledKinds: Partial<Record<AzureResourceKind, boolean>>; account: AzureUserAccount | null; subscription: string; resources: AzureResourceRow[] }) {
  return (
    <>
      <p className="muted">
        One sign-in with your own account; each agent has one switch per kind on its Config page (<Link href="/agents">Agents</Link>). Whatever a read returns goes to the model provider.
      </p>
      {(Object.keys(KINDS) as AzureResourceKind[]).map((kind) => (
        <KindSection key={kind} kind={kind} enabled={enabledKinds[kind] === true} account={account} subscription={subscription} resources={resources.filter((row) => row.kind === kind)} />
      ))}
    </>
  );
}

function KindSection({ kind, enabled, account, subscription, resources }: { kind: AzureResourceKind; enabled: boolean; account: AzureUserAccount | null; subscription: string; resources: AzureResourceRow[] }) {
  const text = KINDS[kind];

  return (
    <div className="card">
      <h3>{text.title}</h3>
      <ReadAzureSwitchForm kind={kind} label={text.switchLabel} enabled={enabled} />
      <p className="muted">{text.help}</p>
      {kind === "azureAccess" ? <AccessSection account={account} subscription={subscription} /> : <ResourcesSection kind={kind} resources={resources} />}
    </div>
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
      {resources.length === 0 ? <p className="muted">Nothing added yet: add one below.</p> : <ResourceTable resources={resources} />}
      <AddAzureResourceForm kind={kind} />
    </>
  );
}

function ResourceTable({ resources }: { resources: AzureResourceRow[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Enabled</th><th>Name</th><th>Account or namespace</th><th></th></tr>
        </thead>
        <tbody>
          {resources.map((row) => <AzureResourceRowForm key={row.name} resource={row} />)}
        </tbody>
      </table>
    </div>
  );
}
