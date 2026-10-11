import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { VaultSelect } from "@/components/VaultSelect";
import { VaultsDialog } from "@/components/VaultsDialog";
import { vaultsHostRoot } from "@/lib/obsidian";
import { vaultChoice } from "@/lib/currentVault";
import "./globals.css";

export const metadata: Metadata = {
  title: "PowerLoom",
  description: "Azure DevOps agent pipeline",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { vaults, current } = await vaultChoice();

  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <span className="brand">PowerLoom</span>
          <nav>
            <Link href="/pbis">Backlog</Link>
            <Link href="/tasks">Tasks</Link>
            <Link href="/reviews">Reviews</Link>
            <Link href="/vault">Vault</Link>
            <Link href="/agents">Agents</Link>
            <Link href="/runs">Runs</Link>
            <Link href="/settings">Settings</Link>
          </nav>
          <VaultSelect vaults={vaults} current={current} dialog={<VaultsDialog vaults={vaults} vaultsRoot={vaultsHostRoot() ?? "the vaults root"} />} />
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
