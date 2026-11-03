"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { createFlow, deleteFlow, listFlows } from "@/lib/flowStore";
import { formatTime } from "@/lib/format";
import type { FlowDefinition } from "@/models/FlowDefinition";

// The saved flows of this browser (localStorage): open one, delete one, start a new one.
export function FlowsList() {
  const router = useRouter();
  const [flows, setFlows] = useState<FlowDefinition[] | null>(null);
  const [name, setName] = useState("");

  useEffect(() => setFlows(listFlows()), []);

  const create = (event: FormEvent) => {
    event.preventDefault();

    const flow = createFlow(name.trim() || `Flow ${(flows?.length ?? 0) + 1}`);

    router.push(`/flows/${flow.id}`);
  };

  const remove = (flow: FlowDefinition) => {
    if (!window.confirm(`Delete flow "${flow.name}"?`)) return;

    deleteFlow(flow.id);
    setFlows(listFlows());
  };

  return (
    <>
      <div className="flows-head">
        <h1>Flows</h1>
        <form onSubmit={create}>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="New flow name" aria-label="New flow name" />
          <button type="submit">New flow</button>
        </form>
      </div>
      {flows === null ? (
        <p className="muted">Loading…</p>
      ) : flows.length === 0 ? (
        <div className="card empty">No flows yet. Name one above and press New flow: the editor opens with the trigger node and the agents of this PowerLoom.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Agents</th>
                <th>Edges</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {flows.map((flow) => (
                <tr key={flow.id}>
                  <td className="title"><Link href={`/flows/${flow.id}`}>{flow.name}</Link></td>
                  <td>{flow.nodes.filter((node) => node.type === "agent").length}</td>
                  <td>{flow.edges.length} ({flow.edges.filter((edge) => edge.data?.kind === "optional").length} optional)</td>
                  <td className="muted">{formatTime(flow.updatedAt)}</td>
                  <td className="actions">
                    <Link href={`/flows/${flow.id}`}><button type="button" className="secondary small">Open</button></Link>
                    <button type="button" className="danger small" onClick={() => remove(flow)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
