import { Dropdown } from "@/components/Dropdown";
import { ClosePbiButton } from "./ClosePbiButton";
import { DeletePbiButton } from "./DeletePbiButton";

// The header's ⋯ menu (user decision 2026-10-18): the rare and the destructive actions, out of the way of Start.
export function MoreActions({ adoId, closedByUser, isClosed }: { adoId: number; closedByUser: boolean; isClosed: boolean }) {
  return (
    <Dropdown label="More actions" align="right" pill trigger={<span aria-hidden="true">⋯</span>}>
      <ClosePbiButton adoId={adoId} closedByUser={closedByUser} isClosed={isClosed} inMenu />
      <div className="menu-sep" />
      <DeletePbiButton adoId={adoId} inMenu />
    </Dropdown>
  );
}
