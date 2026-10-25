import type { GoogleDriveValues } from "@/models/GoogleDriveValues";
import { GoogleDriveAccess } from "./GoogleDriveAccess";
import { GoogleDriveForm } from "./GoogleDriveForm";

// Google Drive (user decision 2026-10-25): the vault's switch and OAuth client, the signed-in account, and the folders
// agents may read. An agent reads them only with its own Google Drive switch on (its Config page).
export function GoogleDrivePanel({ values, message }: { values: GoogleDriveValues; message: string | null }) {
  return (
    <section className="panel settings-card">
      <GoogleDriveForm values={values} />
      <GoogleDriveAccess values={values} message={message} />
    </section>
  );
}
