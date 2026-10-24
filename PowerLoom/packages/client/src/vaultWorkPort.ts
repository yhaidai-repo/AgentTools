import type { VaultWorkPort } from "@powerloom/core";
import { accepted } from "./accepted";
import type { PowerLoomClient } from "./createPowerLoomClient";
import { powerloomFailure } from "./powerloomFailure";

export function vaultWorkPort(powerloom: PowerLoomClient): VaultWorkPort {
  return {
    async setRepoEnabled(vault, id, enabled) {
      return accepted(await powerloom.PUT("/api/vaults/{vault}/repos/{id}/enabled", { params: { path: { vault, id } }, body: { enabled } }));
    },
    async addLocalRepo(vault, name) {
      const { data, error, response } = await powerloom.POST("/api/vaults/{vault}/repos/local", { params: { path: { vault } }, body: { name } });

      return data ? { ok: true, value: data } : powerloomFailure(error, response);
    },
    async removeRepo(vault, id) {
      return accepted(await powerloom.DELETE("/api/vaults/{vault}/repos/{id}", { params: { path: { vault, id } } }));
    },
    async addVault(folder) {
      const { data, error, response } = await powerloom.POST("/api/vaults", { body: { folder } });

      return data ? { ok: true, value: data } : powerloomFailure(error, response);
    },
    async removeVault(vault) {
      const { data, error, response } = await powerloom.DELETE("/api/vaults/{vault}", { params: { path: { vault } } });

      return data ? { ok: true, value: data.vault } : powerloomFailure(error, response);
    },
    async restoreTrash(vault, path) {
      const { data, error, response } = await powerloom.POST("/api/vaults/{vault}/trash/restore", { params: { path: { vault } }, body: { path } });

      return data !== undefined ? { ok: true, value: data } : powerloomFailure(error, response);
    },
    async deleteTrash(vault, path) {
      const { data, error, response } = await powerloom.DELETE("/api/vaults/{vault}/trash", { params: { path: { vault } }, body: { path } });

      return data !== undefined ? { ok: true, value: data } : powerloomFailure(error, response);
    },
    async runCleanup(vault) {
      return accepted(await powerloom.POST("/api/vaults/{vault}/cleanup/run", { params: { path: { vault } } }));
    },
    async replayDeadLetter(id) {
      const { data, error, response } = await powerloom.POST("/api/dead-letters/{id}/replay", { params: { path: { id } } });

      return data ? { ok: true, value: data.id } : powerloomFailure(error, response);
    },
    async discardDeadLetter(id) {
      const { data, error, response } = await powerloom.DELETE("/api/dead-letters/{id}", { params: { path: { id } } });

      return data ? { ok: true, value: data.id } : powerloomFailure(error, response);
    },
  };
}
