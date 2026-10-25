import { chatLauncher } from "@/lib/chatLauncher";
import { ImportFolderForm } from "./ImportFolderForm";

// The import form with the agent app it opens in.
export async function ImportFolderChat({ vault }: { vault: string }) {
  return <ImportFolderForm vault={vault} launcher={await chatLauncher()} />;
}
