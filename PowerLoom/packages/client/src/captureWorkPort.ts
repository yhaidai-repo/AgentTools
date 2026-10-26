import type { CaptureWorkPort } from "@powerloom/core";
import type { PowerLoomClient } from "./createPowerLoomClient";
import { powerloomFailure } from "./powerloomFailure";

export function captureWorkPort(powerloom: PowerLoomClient): CaptureWorkPort {
  return {
    async captureDraft(vault, draft) {
      const { data, error, response } = await powerloom.POST("/api/vaults/{vault}/drafts", { params: { path: { vault } }, body: draft });

      return data ? { ok: true, value: { ok: data.ok, mode: data.mode, path: data.path ?? null, errors: data.errors } } : powerloomFailure(error, response);
    },
    async addRegisterRecord(vault, record) {
      const { data, error, response } = await powerloom.POST("/api/vaults/{vault}/register-records", { params: { path: { vault } }, body: record });

      return data ? { ok: true, value: data.id } : powerloomFailure(error, response);
    },
    async createWwwRecord({ vault, ...record }) {
      const { data, error, response } = await powerloom.POST("/api/vaults/{vault}/www-records", { params: { path: { vault } }, body: record });

      return data ? { ok: true, value: data.id } : powerloomFailure(error, response);
    },
    async closeRegisterRecord(vault, closing) {
      const { data, error, response } = await powerloom.POST("/api/vaults/{vault}/register-records/close", { params: { path: { vault } }, body: closing });

      return data ? { ok: true, value: data } : powerloomFailure(error, response);
    },
  };
}
