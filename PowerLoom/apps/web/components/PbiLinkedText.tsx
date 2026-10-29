import Link from "next/link";
import { Fragment } from "react";
import { splitPbiMentions } from "@/lib/pbiMentions";

// Every PBI mention in agent-written text (e.g. "Confirm repos for PBI-30270") links to that PBI's page; a versioned
// reference (PBI-30270:plan) to the PBI's latest result of that kind.
export function PbiLinkedText({ text }: { text: string }) {
  const parts = splitPbiMentions(text);

  return <>{parts.map((part, index) => <Fragment key={index}>{typeof part === "string" ? part : <Link href={part.href}>{part.text}</Link>}</Fragment>)}</>;
}
