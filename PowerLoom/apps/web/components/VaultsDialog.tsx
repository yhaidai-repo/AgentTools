import { AddVaultForm } from "./AddVaultForm";
import { CloseDialogButton } from "./CloseDialogButton";
import { ContinueChat } from "./ContinueChat";
import { RemoveVaultForm } from "./RemoveVaultForm";

// The vaults PowerLoom works for (user decision 2026-10-05), managed from the top bar's menu (user decision 2026-10-06): a
// folder of the vaults root is added as a vault and prepared by the worker; "Configure with <agent>" opens a chat that
// sets the vault up on the PC; removing one makes PowerLoom forget it.
export function VaultsDialog({ vaults, vaultsRoot, freeFolders }: { vaults: string[]; vaultsRoot: string; freeFolders: string[] }) {
  return (
    <div className="vaults-body">
      <h2>Vaults</h2>
      <p className="muted">Each vault is an account: the top bar picks the one every page shows.</p>
      {vaults.length > 0 && <VaultRows vaults={vaults} vaultsRoot={vaultsRoot} />}
      <AddVaultForm vaultsRoot={vaultsRoot} freeFolders={freeFolders} />
      <div className="actions">
        <CloseDialogButton />
      </div>
    </div>
  );
}

function VaultRows({ vaults, vaultsRoot }: { vaults: string[]; vaultsRoot: string }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Vault</th><th>Folder</th><th></th><th></th></tr>
        </thead>
        <tbody>
          {vaults.map((vault) => (
            <tr key={vault}>
              <td>{vault}</td>
              <td><code>{vaultsRoot}/{vault}</code></td>
              <td><ContinueChat target={{ kind: "vault", vault }} verb="Configure" /></td>
              <td><RemoveVaultForm vault={vault} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
