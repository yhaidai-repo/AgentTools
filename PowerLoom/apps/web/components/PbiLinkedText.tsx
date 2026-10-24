import Link from "next/link";
import { Fragment } from "react";

// Every PBI mention in agent-written text (e.g. "Confirm repos for PBI-30270") links to that PBI's page.
const PBI_MENTION = /PBI-(\d+)/g;

export function PbiLinkedText({ text }: { text: string }) {
  const parts = text.split(PBI_MENTION);

  // split() with a capture group alternates: text, id, text, id, ...
  return <>{parts.map((part, index) => <Fragment key={index}>{index % 2 === 1 ? <Link href={`/pbis/${part}`}>PBI-{part}</Link> : part}</Fragment>)}</>;
}
