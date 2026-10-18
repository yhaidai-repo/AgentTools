"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PAGES = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/pbis", label: "Backlog" },
  { href: "/tasks", label: "Tasks" },
  { href: "/reviews", label: "Reviews" },
  { href: "/vault", label: "Vault" },
  { href: "/agents", label: "Agents" },
  { href: "/settings", label: "Settings" },
];

// The top menu's page links; the page you are on (or one of its sub-pages) is the lit pill.
export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="bar-nav">
      {PAGES.map((page) => (
        <Link key={page.href} href={page.href} className={isOn(pathname, page.href) ? "active" : undefined}>{page.label}</Link>
      ))}
    </nav>
  );
}

function isOn(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
