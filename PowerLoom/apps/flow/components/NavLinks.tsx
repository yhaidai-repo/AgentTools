"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PAGES = [
  { href: "/", label: "Flows" },
  { href: "/executions", label: "Executions" },
];

// The header's own pages (lit pill = the page you are on) and the external links into the web app.
export function NavLinks({ webUrl }: { webUrl: string }) {
  const pathname = usePathname();

  return (
    <nav className="bar-nav">
      {PAGES.map((page) => (
        <Link key={page.href} href={page.href} className={isOn(pathname, page.href) ? "active" : undefined}>{page.label}</Link>
      ))}
      <span className="bar-sep" />
      <a href={`${webUrl}/tasks`} className="external" title="PowerLoom web: Tasks">Tasks ↗</a>
      <a href={`${webUrl}/agents`} className="external" title="PowerLoom web: Agents">Agents ↗</a>
    </nav>
  );
}

function isOn(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" || pathname.startsWith("/flows") : pathname === href || pathname.startsWith(`${href}/`);
}
