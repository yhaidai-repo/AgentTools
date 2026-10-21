import type { ChildItem } from "@powerloom/core";
import Link from "next/link";
import { PipelinePill } from "@/components/PipelinePill";
import { TypeTag } from "@/components/TypeTag";

// A PBI's child items in the narrow side column (user, 2026-10-21), like its runs: the id, type and pipeline on one
// line, the title under them.
export function ChildItemRows({ items }: { items: ChildItem[] }) {
  return (
    <div className="item-rows">
      {items.map((item) => (
        <div key={item.adoId} className="item-row">
          <Link href={`/pbis/${item.adoId}`} className="id">{item.adoId}</Link>
          <TypeTag type={item.type} bugSource={item.bugSource} />
          <span className="item-state"><PipelinePill status={item.pipelineStatus} /></span>
          <Link href={`/pbis/${item.adoId}`} className="child-row-title">{item.title}</Link>
        </div>
      ))}
    </div>
  );
}
