import type { AzureMcpInputSchema, AzureMcpProperty } from "@powerloom/azure";
import { z } from "zod";

// The Azure MCP server describes a tool's input as JSON Schema; the runtime wants a zod shape. Only what the server
// uses is covered: flat properties of string, integer, number, boolean, array and object, an enum, `["x", "null"]`
// for nullable, and the required list. A nullable or non-required property is optional for the agent.
export function jsonSchemaShape(schema: AzureMcpInputSchema, omit: string[] = []): z.ZodRawShape {
  const shape: Record<string, z.ZodType> = {};

  for (const [name, property] of Object.entries(schema.properties)) {
    if (omit.includes(name)) {
      continue;
    }

    const required = schema.required.includes(name) && !isNullable(property);
    const field = fieldOf(property);

    shape[name] = required ? field : field.optional();
  }

  return shape;
}

function fieldOf(property: AzureMcpProperty): z.ZodType {
  const field = typeOf(property);

  return property.description ? field.describe(property.description) : field;
}

function typeOf(property: AzureMcpProperty): z.ZodType {
  if (property.enum && property.enum.length > 0) {
    return z.enum(property.enum as [string, ...string[]]);
  }

  switch (firstType(property)) {
    case "integer":
      return z.number().int();
    case "number":
      return z.number();
    case "boolean":
      return z.boolean();
    case "array":
      return z.array(typeOf({ type: property.items?.type ?? "string" }));
    case "object":
      return z.record(z.string(), z.unknown());
    default:
      return z.string();
  }
}

function firstType(property: AzureMcpProperty): string {
  const types = Array.isArray(property.type) ? property.type : [property.type ?? "string"];

  return types.find((type) => type !== "null") ?? "string";
}

function isNullable(property: AzureMcpProperty): boolean {
  return Array.isArray(property.type) && property.type.includes("null");
}
