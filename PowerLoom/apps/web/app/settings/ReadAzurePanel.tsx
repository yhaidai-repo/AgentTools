import Link from "next/link";
import type { AzureIdentityValues } from "@/models/AzureIdentityValues";
import type { AzureResourceRow } from "@/models/AzureResourceRow";
import { AddAzureResourceForm } from "./AddAzureResourceForm";
import { AzureIdentityForm } from "./AzureIdentityForm";
import { AzureResourceRowForm } from "./AzureResourceRowForm";
import { ReadAzureSwitchForm } from "./ReadAzureSwitchForm";

// Read Azure (user decision 2026-10-12): the vault's switch, its service principal and its resources. An agent reads a
// kind only with that kind's switch on (its Config page).
export function ReadAzurePanel({ enabled, identity, resources }: { enabled: boolean; identity: AzureIdentityValues; resources: AzureResourceRow[] }) {
  return (
    <div className="card">
      <ReadAzureSwitchForm enabled={enabled} />
      <p className="muted">
        Agents may read App Insights logs, Cosmos documents, Service Bus counts and peeked messages, and Mongo documents during their runs; each agent has one switch per kind on its Config page (<Link href="/agents">Agents</Link>). Whatever a read returns goes to the model provider: add only resources whose data may leave this PC.
      </p>
      <h3>Identity</h3>
      <p className="muted">An Entra app registration with read-only roles: Log Analytics Reader on the App Insights components, Cosmos DB Built-in Data Reader on the Cosmos accounts, Azure Service Bus Data Receiver and Reader on the namespaces. Mongo uses its own connection string instead.</p>
      <AzureIdentityForm values={identity} />
      <h3>Resources</h3>
      {resources.length === 0 ? <p className="muted">No resources yet: add one below.</p> : <ResourceTable resources={resources} />}
      <AddAzureResourceForm />
    </div>
  );
}

function ResourceTable({ resources }: { resources: AzureResourceRow[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Enabled</th><th>Name</th><th>Kind</th><th>Target</th><th></th></tr>
        </thead>
        <tbody>
          {resources.map((row) => <AzureResourceRowForm key={row.name} resource={row} />)}
        </tbody>
      </table>
    </div>
  );
}
