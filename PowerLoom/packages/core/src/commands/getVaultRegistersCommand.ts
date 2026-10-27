import { z } from "zod";
import type { Command } from "../models/Command";
import type { RegisterRow } from "../models/RegisterRow";
import type { VaultRegisterRows } from "../models/VaultRegisterRows";
import { REGISTERS, registerRows, wwwRows, type RegisterKey } from "../vaultPage/registerRows";
import { mountedVaultRoot } from "../vaultPage/vaultRoot";
import { readVaultRegisters } from "../vaultPage/vaultRegisters";
import { vaultInput } from "./inputs";

const ALL_REGISTERS = "all";
const REGISTER_KEYS = REGISTERS.map((register) => register.key) as [RegisterKey, ...RegisterKey[]];

type GetVaultRegistersInput = { vault: string; kind: RegisterKey | typeof ALL_REGISTERS; openOnly: boolean };

// The Maintenance tab's registers: the vault's What-went-wrong log and every project's known issues and open questions,
// open records first, then the latest change first.
export const getVaultRegistersCommand: Command<GetVaultRegistersInput, VaultRegisterRows> = {
  name: "vault.registers",
  effect: "read",
  description: "A docs vault's registers as the Vault page's Maintenance tab lists them: What-went-wrong records (www-log.md), and each project's known issues (KI-nnn) and open questions (OQ-nnn), with id, title, status, project and date. Open records only unless openOnly is false; kind picks one register.",
  input: z.object({
    vault: vaultInput,
    kind: z.enum([...REGISTER_KEYS, ALL_REGISTERS]).default(ALL_REGISTERS).describe("One register (www, issues, questions) or all"),
    openOnly: z.boolean().default(true).describe("Only open records (false lists resolved and fixed ones too)"),
  }),
  async run(context, input) {
    const root = await mountedVaultRoot(input.vault, context.db);

    if (!root.ok) {
      return root;
    }

    const registers = await readVaultRegisters(root.value);
    const rows: VaultRegisterRows = { www: wwwRows(registers.www), issues: registerRows(registers.issues), questions: registerRows(registers.questions) };

    return { ok: true, value: { www: asked(rows.www, "www", input), issues: asked(rows.issues, "issues", input), questions: asked(rows.questions, "questions", input) } };
  },
};

function asked(rows: RegisterRow[], key: RegisterKey, input: GetVaultRegistersInput): RegisterRow[] {
  if (input.kind !== ALL_REGISTERS && input.kind !== key) {
    return [];
  }

  return rows.filter((row) => !input.openOnly || row.isOpen);
}
