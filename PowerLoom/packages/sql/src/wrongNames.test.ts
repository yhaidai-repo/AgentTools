import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isWrongNameError, qualifiedParts, wrongNamesOf } from "./wrongNames";

const ERRORS = [
  { number: 207, message: "Invalid column name 'FacilityID'." },
  { number: 207, message: "Invalid column name 'facilityid'." },
  { number: 208, message: "Invalid object name 'dbo.Facilities'." },
  { number: 209, message: "Ambiguous column name 'Id'." },
  { number: 4104, message: 'The multi-part identifier "v.Status" could not be bound.' },
];

describe("isWrongNameError", () => {
  it("is true when any error is about a name", () => {
    assert.equal(isWrongNameError([{ number: 102, message: "Incorrect syntax" }, ERRORS[4]]), true);
    assert.equal(isWrongNameError([{ number: 102, message: "Incorrect syntax" }]), false);
    assert.equal(isWrongNameError([]), false);
  });
});

describe("wrongNamesOf", () => {
  it("takes each wrong name from its message once, in the server's order", () => {
    assert.deepEqual(wrongNamesOf(ERRORS), [
      { kind: "column", name: "FacilityID" },
      { kind: "table", name: "dbo.Facilities" },
      { kind: "ambiguous", name: "Id" },
      { kind: "unbound", name: "v.Status" },
    ]);
  });
});

describe("qualifiedParts", () => {
  it("splits the qualifier from the column", () => {
    assert.deepEqual(qualifiedParts("v.Status"), ["v", "Status"]);
    assert.deepEqual(qualifiedParts("dbo.Facility.Id"), ["dbo.Facility", "Id"]);
    assert.deepEqual(qualifiedParts("Id"), ["", "Id"]);
  });
});
