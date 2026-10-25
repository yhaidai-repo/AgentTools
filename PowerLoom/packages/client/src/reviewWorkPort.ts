import type { Outcome, ReviewWorkPort } from "@powerloom/core";
import { accepted } from "./accepted";
import type { PowerLoomClient } from "./createPowerLoomClient";
import { powerloomFailure } from "./powerloomFailure";
import type { components } from "./schema";

export function reviewWorkPort(powerloom: PowerLoomClient): ReviewWorkPort {
  return {
    async addReview(review) {
      const { data, error, response } = await powerloom.POST("/api/reviews", { body: review });

      return data ? { ok: true, value: data } : powerloomFailure(error, response);
    },
    async addLocalReview(review) {
      const { data, error, response } = await powerloom.POST("/api/reviews/local", { body: review });

      return data ? { ok: true, value: data } : powerloomFailure(error, response);
    },
    async queueReview(prId) {
      const { data, error, response } = await powerloom.POST("/api/reviews/queue", { body: { prIds: [prId] } });

      return data ? oneReview(data) : powerloomFailure(error, response);
    },
    async closeReview(prId, reason) {
      const { data, error, response } = await powerloom.POST("/api/reviews/close", { body: { prIds: [prId], reason } });

      return data ? oneReview(data) : powerloomFailure(error, response);
    },
    async syncPullRequests(vault) {
      return accepted(await powerloom.POST("/api/ado/pull-requests/sync", { body: { vault } }));
    },
  };
}

// The review endpoints answer per PR; for one PR, its line is the outcome.
function oneReview(data: components["schemas"]["ReviewsResult"]): Outcome<string> {
  return data.refused.length === 0 ? { ok: true, value: data.done[0]?.value ?? "" } : { ok: false, error: data.refused[0] };
}
