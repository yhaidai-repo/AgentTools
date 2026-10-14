import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import { jsonSchemaShape } from "./jsonSchemaShape";

describe("jsonSchemaShape", () => {
  it("maps the server's property types, keeps required ones required and drops omitted ones", () => {
    const shape = jsonSchemaShape(
      {
        properties: {
          query: { type: "string", description: "KQL" },
          limit: { type: ["integer", "null"] },
          hours: { type: "number" },
          deep: { type: "boolean" },
          resources: { type: "array", items: { type: "string" } },
          mode: { type: "string", enum: ["fixed", "exponential"] },
          tenant: { type: "string" },
        },
        required: ["query", "limit"],
      },
      ["tenant"],
    );
    const parsed = z.object(shape).safeParse({ query: "requests | take 1", hours: 2.5, deep: true, resources: ["a"], mode: "fixed" });
    const missing = z.object(shape).safeParse({ hours: 1 });
    const wrong = z.object(shape).safeParse({ query: "x", limit: 1.5 });

    assert.ok(parsed.success, JSON.stringify(parsed.error));
    assert.equal("tenant" in shape, false);
    assert.equal((shape.query as z.ZodType).description, "KQL");
    assert.equal(missing.success, false);
    assert.equal(wrong.success, false);
  });
});
