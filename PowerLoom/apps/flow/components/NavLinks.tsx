"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PAGES = [
  { href: "/", label: "Flows" },
  { href: "/executions", label: "Executions" },
];

const WEB_PAGES = [
  { path: "/tasks", label: "Tasks" },
  { path: "/agents", label: "Agents" },
  { path: "/pbis", label: "Backlog" },
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
      {WEB_PAGES.map((page) => (
        <a key={page.path} href={`${webUrl}${page.path}`} className="external" title={`PowerLoom web: ${page.label}`}>{page.label} ↗</a>
      ))}
    </nav>
  );
}

function isOn(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" || pathname.startsWith("/flows") : pathname === href || pathname.startsWith(`${href}/`);
}
