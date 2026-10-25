import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import { PLAYWRIGHT_MCP_TOOLS } from "../browser/playwrightMcpTools";
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

  it("keeps nested objects whole: browser_fill_form's fields need their target, name, type and value", () => {
    const fillForm = PLAYWRIGHT_MCP_TOOLS.find((tool) => tool.name === "browser_fill_form")!;
    const input = z.object(jsonSchemaShape(fillForm.inputSchema as never));
    const field = { target: "e12", name: "Email", type: "textbox", value: "a@b.c" };

    assert.equal(input.safeParse({ fields: [{}] }).success, false);
    assert.equal(input.safeParse({ fields: [{ ...field, type: "button" }] }).success, false);
    assert.ok(input.safeParse({ fields: [field] }).success);
    assert.match(JSON.stringify(z.toJSONSchema(input)), /If the field is a checkbox, the value should be/);
  });

  it("keeps a nullable enum's values and allows null", () => {
    const shape = jsonSchemaShape({ properties: { colorScheme: { anyOf: [{ type: "string", enum: ["light", "dark"] }, { type: "null" }] } }, required: [] } as never);
    const input = z.object(shape);

    assert.ok(input.safeParse({ colorScheme: null }).success);
    assert.ok(input.safeParse({ colorScheme: "dark" }).success);
    assert.equal(input.safeParse({ colorScheme: "blue" }).success, false);
  });

  it("lets a required nullable field be null, and sends null for it when left out", () => {
    const input = z.object(jsonSchemaShape({ properties: { limit: { type: ["integer", "null"] } }, required: ["limit"] } as never));

    assert.deepEqual(input.safeParse({ limit: null }).data, { limit: null });
    assert.deepEqual(input.safeParse({}).data, { limit: null });
    assert.equal(input.safeParse({ limit: 1.5 }).success, false);
  });

  it("keeps the extra properties an object allows, checked against their schema", () => {
    const shape = jsonSchemaShape({ properties: { filter: { type: "object", properties: { known: { type: "string" } }, additionalProperties: { type: "number" } } }, required: [] } as never);
    const input = z.object(shape);

    assert.deepEqual(input.safeParse({ filter: { known: "x", extra: 42 } }).data, { filter: { known: "x", extra: 42 } });
    assert.equal(input.safeParse({ filter: { known: "x", extra: "many" } }).success, false);
  });

  it("passes on what it can't check instead of narrowing it", () => {
    const shape = jsonSchemaShape({ properties: { pick: { oneOf: [{ type: "string" }, { type: "integer" }], description: "One" } }, required: ["pick"] } as never);

    assert.ok(z.object(shape).safeParse({ pick: 3 }).success);
    assert.match((shape.pick as z.ZodType).description ?? "", /not checked before the call: the schema uses oneOf/);
  });

  it("converts every browser tool of the catalog", () => {
    for (const tool of PLAYWRIGHT_MCP_TOOLS) {
      assert.doesNotThrow(() => z.toJSONSchema(z.object(jsonSchemaShape(tool.inputSchema as never))), tool.name);
    }
  });
});
