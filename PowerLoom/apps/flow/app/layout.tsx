import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { NavLinks } from "@/components/NavLinks";
import { vaultChoice } from "@/lib/currentVault";
import { webUrl } from "@/lib/webUrl";
import "@xyflow/react/dist/style.css";
import "./globals.css";
import "./styles/shell.css";
import "./styles/flow.css";

export const metadata: Metadata = {
  title: "PowerLoom Flow",
  description: "Agent workflows on a canvas",
};

const FONTS_URL = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap";

// Flow's own header (design decision: each app has its own header with external links to the others). The vault is the
// one the web app selected (its cookie, shared on 127.0.0.1); the switch stays there.
export default async function RootLayout({ children }: { children: ReactNode }) {
  const { current } = await vaultChoice();

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS_URL} />
      </head>
      <body>
        <div className="bar-wrap">
          <header className="bar">
            <Link href="/" className="brand">PowerLoom <span className="brand-app">Flow</span></Link>
            <span className="bar-sep" />
            <NavLinks webUrl={webUrl()} />
            <span className="bar-sep" />
            <a href={`${webUrl()}/vault`} className="bar-vault" title="The vault the web app selected; switch it there">{current ?? "no vault"}</a>
          </header>
        </div>
        <main>{children}</main>
      </body>
    </html>
  );
}
