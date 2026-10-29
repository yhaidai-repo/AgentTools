import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { NavLinks } from "@/components/NavLinks";
import { VaultSelect } from "@/components/VaultSelect";
import { VaultsDialog } from "@/components/VaultsDialog";
import { freeVaultFolders } from "@/lib/freeVaultFolders";
import { vaultsHostRoot } from "@/lib/obsidian";
import { vaultChoice } from "@/lib/currentVault";
import "./globals.css";
import "./styles/shell.css";
import "./styles/panels.css";
import "./styles/dashboard.css";
import "./styles/pbis.css";
import "./styles/pbi-page.css";
import "./styles/forms.css";
import "./styles/tasks.css";
import "./styles/reviews.css";
import "./styles/vault.css";
import "./styles/agents.css";
import "./styles/settings.css";
import "./styles/results.css";

export const metadata: Metadata = {
  title: "PowerLoom",
  description: "Azure DevOps agent pipeline",
};

const FONTS_URL = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap";

// The frame of every page: the floating top menu (user decision 2026-10-18: a see-through pill with the page links and
// the vault switcher, no logo yet) over the page.
export default async function RootLayout({ children }: { children: ReactNode }) {
  const { vaults, current } = await vaultChoice();

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
            <Link href="/dashboard" className="brand">PowerLoom</Link>
            <span className="bar-sep" />
            <NavLinks />
            <span className="bar-sep" />
            <VaultSelect vaults={vaults} current={current} dialog={<VaultsDialog vaults={vaults} vaultsRoot={vaultsHostRoot() ?? "the vaults root"} freeFolders={await freeVaultFolders(vaults)} />} />
          </header>
        </div>
        <main>{children}</main>
      </body>
    </html>
  );
}
