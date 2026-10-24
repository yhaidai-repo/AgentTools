import Link from "next/link";
import { Fragment } from "react";
import type { Crumb } from "@/models/Crumb";

// Where a detail page sits (user request 2026-10-18): the lists above it as links, the page itself last.
export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      {crumbs.map((crumb, index) => (
        <Fragment key={crumb.label}>
          {index > 0 && <span className="crumb-sep">/</span>}
          {crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : <span className="crumb-here" aria-current="page">{crumb.label}</span>}
        </Fragment>
      ))}
    </nav>
  );
}
