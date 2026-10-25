import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { closestNames, editDistance } from "./closestNames";

describe("closestNames", () => {
  const columns = ["f.FacilityId", "f.Title", "f.TenantId", "v.SubscriptionStatus", "v.CreatedAtUtc", "v.Id"];

  it("finds a name that differs in case or underscores first", () => {
    assert.deepEqual(closestNames("FacilityID", columns)[0], "f.FacilityId");
    assert.deepEqual(closestNames("Facility_Id", columns)[0], "f.FacilityId");
  });

  it("finds a name inside a longer one and a few edits away", () => {
    assert.deepEqual(closestNames("Status", columns), ["v.SubscriptionStatus"]);
    assert.deepEqual(closestNames("CreatedAt", columns), ["v.CreatedAtUtc"]);
    assert.deepEqual(closestNames("dbo.Facilities", ["dbo.Facility", "dbo.Tenant"]), ["dbo.Facility"]);
  });

  it("keeps short names strict and gives nothing for an unrelated name", () => {
    assert.deepEqual(closestNames("Ip", columns), ["v.Id"]);
    assert.deepEqual(closestNames("Xy", columns), []);
    assert.deepEqual(closestNames("AccountName", columns), []);
  });
});

describe("editDistance", () => {
  it("counts insertions, deletions and substitutions", () => {
    assert.equal(editDistance("facility", "facilities"), 3);
    assert.equal(editDistance("", "abc"), 3);
    assert.equal(editDistance("same", "same"), 0);
  });
});
