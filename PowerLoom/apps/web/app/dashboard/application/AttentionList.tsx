import Link from "next/link";
import type { Attention } from "@/lib/systemStatus";
import { nodeById } from "./schemeLayout";

// What PowerLoom asks the user to look at; each entry opens the scheme at its component's level and marks it.
export function AttentionList({ items }: { items: Attention[] }) {
  return (
    <ul className="attention-list">
      {items.map((item, index) => (
        <li key={index} className={item.severity === "failed" ? "text-error" : "text-warn"}>
          <Link href={linkTo(item.component)}>{item.message}</Link>
        </li>
      ))}
    </ul>
  );
}

function linkTo(component: string): string {
  const parent = nodeById(component)?.parent;

  return `/dashboard?tab=application${parent ? `&focus=${parent}` : ""}&mark=${component}`;
}
