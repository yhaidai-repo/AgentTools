import Link from "next/link";
import type { AzureResourceKind, AzureUserAccount } from "@powerloom/core";
import type { AzureResourceRow } from "@/models/AzureResourceRow";
import { AddAzureResourceForm } from "./AddAzureResourceForm";
import { AzureResourceRowForm } from "./AzureResourceRowForm";
import { AzureUserLoginForm } from "./AzureUserLoginForm";
import { ReadAzureSwitchForm } from "./ReadAzureSwitchForm";

interface KindText {
  title: string;
  switchLabel: string;
  help: string;
}

// One feature per kind (user decision 2026-10-13), each with its own switch and resources.
const KINDS: Record<AzureResourceKind, KindText> = {
  appInsights: { title: "App Insights logs", switchLabel: "Enabled: agents with the App Insights switch on may run KQL queries on the resources below, as you", help: "Logs are read with your own sign-in; the token is good for the logs API only, and the runner keeps the sign-in for this vault." },
  cosmos: { title: "Cosmos DB", switchLabel: "Enabled: agents with the Cosmos DB switch on may query the accounts below", help: "Each account is read with its read-only key: the service refuses writes." },
  serviceBus: { title: "Service Bus", switchLabel: "Enabled: agents with the Service Bus switch on may peek messages in the namespaces below", help: "Each namespace is read with a Listen-only policy. Agents only peek (messages stay in place); there is no counts tool without a Manage policy." },
  mongo: { title: "Mongo", switchLabel: "Enabled: agents with the Mongo switch on may find documents in the accounts below", help: "Each account is read with its read-only connection string." },
};

export function ReadAzurePanel({ enabledKinds, account, resources }: { enabledKinds: Partial<Record<AzureResourceKind, boolean>>; account: AzureUserAccount | null; resources: AzureResourceRow[] }) {
  return (
    <>
      <p className="muted">
        Four features, one per kind; each agent has one switch per kind on its Config page (<Link href="/agents">Agents</Link>). Whatever a read returns goes to the model provider: add only resources whose data may leave this PC.
      </p>
      {(Object.keys(KINDS) as AzureResourceKind[]).map((kind) => (
        <KindSection key={kind} kind={kind} enabled={enabledKinds[kind] === true} account={account} resources={resources.filter((row) => row.kind === kind)} />
      ))}
    </>
  );
}

function KindSection({ kind, enabled, account, resources }: { kind: AzureResourceKind; enabled: boolean; account: AzureUserAccount | null; resources: AzureResourceRow[] }) {
  const text = KINDS[kind];

  return (
    <div className="card">
      <h3>{text.title}</h3>
      <ReadAzureSwitchForm kind={kind} label={text.switchLabel} enabled={enabled} />
      <p className="muted">{text.help}</p>
      {kind === "appInsights" && <AzureUserLoginForm account={account} />}
      {resources.length === 0 ? <p className="muted">No resources yet: add one below.</p> : <ResourceTable resources={resources} />}
      <AddAzureResourceForm kind={kind} />
    </div>
  );
}

function ResourceTable({ resources }: { resources: AzureResourceRow[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Enabled</th><th>Name</th><th>Target</th><th></th></tr>
        </thead>
        <tbody>
          {resources.map((row) => <AzureResourceRowForm key={row.name} resource={row} />)}
        </tbody>
      </table>
    </div>
  );
}
