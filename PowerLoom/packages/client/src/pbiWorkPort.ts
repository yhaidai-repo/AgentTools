import type { AttachmentFile, AttachmentTarget, PbiWorkPort } from "@powerloom/core";
import { accepted } from "./accepted";
import type { PowerLoomClient } from "./createPowerLoomClient";
import { powerloomFailure } from "./powerloomFailure";

export function pbiWorkPort(powerloom: PowerLoomClient): PbiWorkPort {
  return {
    async preparePbis(adoIds) {
      const { data, error, response } = await powerloom.POST("/api/pbis/prepare", { body: { adoIds } });

      return data ? { ok: true, value: data } : powerloomFailure(error, response);
    },
    async planPbis(adoIds) {
      const { data, error, response } = await powerloom.POST("/api/pbis/plan", { body: { adoIds } });

      return data ? { ok: true, value: data } : powerloomFailure(error, response);
    },
    async syncAdo(vault, adoId, sources) {
      return accepted(await powerloom.POST("/api/ado/pbis/sync", { body: { vault, adoId, sources } }));
    },
    async pbiUserNotes(adoId) {
      const { data, error, response } = await powerloom.GET("/api/pbis/{adoId}/user-notes", { params: { path: { adoId } } });

      return data ? { ok: true, value: data.text } : powerloomFailure(error, response);
    },
    async savePbiUserNotes(adoId, text, loadedText) {
      const { data, error, response } = await powerloom.PUT("/api/pbis/{adoId}/user-notes", { params: { path: { adoId } }, body: { text, loadedText } });

      return data ? { ok: true, value: data.text } : powerloomFailure(error, response);
    },
    async attachToPbi(adoId, files, target) {
      const { data, error, response } = await powerloom.POST("/api/pbis/{adoId}/attachments", { params: { path: { adoId } }, body: uploadForm(files, target) as never, bodySerializer: (body) => body as unknown as FormData });

      return data ? { ok: true, value: data.refs } : powerloomFailure(error, response);
    },
    async addConfluenceLink(adoId, url, why) {
      const { data, error, response } = await powerloom.POST("/api/pbis/{adoId}/confluence-links", { params: { path: { adoId } }, body: { url, why } });

      return data ? { ok: true, value: data } : powerloomFailure(error, response);
    },
    async removeConfluenceLink(adoId, url) {
      const { data, error, response } = await powerloom.DELETE("/api/pbis/{adoId}/confluence-links", { params: { path: { adoId } }, body: { url } });

      return data ? { ok: true, value: data } : powerloomFailure(error, response);
    },
    async loadConfluencePage(adoId, url) {
      return accepted(await powerloom.POST("/api/pbis/{adoId}/confluence-pages/load", { params: { path: { adoId } }, body: { url } }));
    },
  };
}

// The attachments endpoint takes a multipart form: the files, and what they answer or replace.
function uploadForm(files: AttachmentFile[], target: AttachmentTarget): FormData {
  const form = new FormData();

  files.forEach((file) => form.append("files", new Blob([new Uint8Array(file.bytes)], { type: file.contentType || "application/octet-stream" }), file.fileName));

  if (target.itemId) {
    form.append("itemId", target.itemId);
  }

  if (target.sourceUrl) {
    form.append("sourceUrl", target.sourceUrl);
  }

  return form;
}
