import Link from "next/link";
import { REGISTERS, type RegisterKey } from "@/lib/registerRows";
import { vaultUrl } from "@/lib/vaultUrl";
import type { RegisterRow } from "@/models/RegisterRow";

interface RegisterFiltersProps {
  register: RegisterKey;
  onlyOpen: boolean;
  rowsByRegister: Record<RegisterKey, RegisterRow[]>;
}

// Which register, with its open count (amber while What went wrong has open misses), and open or all records.
export function RegisterFilters({ register, onlyOpen, rowsByRegister }: RegisterFiltersProps) {
  const show = onlyOpen ? "open" : "all";

  return (
    <div className="tab-bar register-bar">
      <nav className="seg" aria-label="Register">
        {REGISTERS.map((choice) => {
          const open = rowsByRegister[choice.key].filter((row) => row.isOpen).length;
          const needsYou = rowsByRegister[choice.key].some((row) => row.needsAttention);

          return (
            <Link key={choice.key} href={vaultUrl({ tab: "maintenance", register: choice.key, show })} className={choice.key === register ? "active" : undefined}>
              {choice.label}<b className={needsYou ? "seg-count warn" : "seg-count"}>{open}</b>
            </Link>
          );
        })}
      </nav>
      <nav className="status-pills" aria-label="Open or all">
        <Link href={vaultUrl({ tab: "maintenance", register, show: "open" })} className={onlyOpen ? "status-pill on" : "status-pill"}>Open</Link>
        <Link href={vaultUrl({ tab: "maintenance", register, show: "all" })} className={onlyOpen ? "status-pill" : "status-pill on"}>All <b>{rowsByRegister[register].length}</b></Link>
      </nav>
    </div>
  );
}
