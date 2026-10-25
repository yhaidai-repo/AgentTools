import type { AzureMcpInputSchema } from "@powerloom/azure";
import { z } from "zod";

// The part of JSON Schema an MCP server's tool input uses, nested: objects with their own required list, array items,
// enums, `anyOf` (most often "this or null"), typed maps and number bounds.
interface JsonSchemaProperty {
  type?: string | string[];
  description?: string;
  enum?: unknown[];
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean | JsonSchemaProperty;
  anyOf?: JsonSchemaProperty[];
  minimum?: number;
  maximum?: number;
  [keyword: string]: unknown;
}

// Keywords this conversion can't express; a property using one is passed on unchecked and says so, rather than being
// narrowed to a type the server never asked for.
const UNSUPPORTED = ["oneOf", "allOf", "not", "$ref", "if"];

// The MCP servers (Azure MCP, Playwright MCP) describe a tool's input as JSON Schema; the runtime wants a zod shape.
// Nested objects keep their properties, required fields and descriptions, so the agent sees the whole contract and a
// wrong call fails here instead of at the server. A non-required property is optional; a nullable one takes null, and
// when it is also required an omitted value is sent as null, so the server still gets the key it requires.
export function jsonSchemaShape(schema: AzureMcpInputSchema, omit: string[] = []): z.ZodRawShape {
  return shapeOf(schema as unknown as JsonSchemaProperty, omit);
}

function shapeOf(schema: JsonSchemaProperty, omit: string[] = []): Record<string, z.ZodType> {
  const shape: Record<string, z.ZodType> = {};
  const required = schema.required ?? [];

  for (const [name, property] of Object.entries(schema.properties ?? {})) {
    if (omit.includes(name)) {
      continue;
    }

    const field = fieldOf(property);

    shape[name] = !required.includes(name) ? field.optional() : isNullable(property) ? field.default(null) : field;
  }

  return shape;
}

function fieldOf(property: JsonSchemaProperty): z.ZodType {
  const unsupported = UNSUPPORTED.find((keyword) => keyword in property);

  if (unsupported) {
    return z.unknown().describe(`${property.description ?? ""} (not checked before the call: the schema uses ${unsupported})`.trim());
  }

  // Nullable wherever the schema says so: a property, an array's items, a map's values.
  const typed = typeOf(property);
  const field = isNullable(property) ? typed.nullable() : typed;

  return property.description ? field.describe(property.description) : field;
}

function typeOf(property: JsonSchemaProperty): z.ZodType {
  if (property.anyOf && property.anyOf.length > 0) {
    return unionOf(property.anyOf);
  }

  if (property.enum && property.enum.length > 0) {
    return enumOf(property.enum);
  }

  switch (firstType(property)) {
    case "integer":
      return bounded(z.number().int(), property);
    case "number":
      return bounded(z.number(), property);
    case "boolean":
      return z.boolean();
    case "array":
      return z.array(property.items ? fieldOf(property.items) : z.string());
    case "object":
      return objectOf(property);
    default:
      return z.string();
  }
}

// "This or null" stays one type that may be null; a real choice of types becomes a union.
function unionOf(options: JsonSchemaProperty[]): z.ZodType {
  const nonNull = options.filter((option) => option.type !== "null");
  const types = nonNull.map((option) => fieldOf(option));
  const base = types.length === 1 ? types[0] : z.union(types as unknown as [z.ZodType, z.ZodType, ...z.ZodType[]]);

  return nonNull.length < options.length ? base.nullable() : base;
}

function enumOf(values: unknown[]): z.ZodType {
  const strings = values.filter((value): value is string => typeof value === "string");

  return strings.length === values.length ? z.enum(strings as [string, ...string[]]) : z.union(values.map((value) => z.literal(value as string | number | boolean)) as unknown as [z.ZodType, z.ZodType]);
}

// An object with properties keeps them, and keeps other properties as the schema allows them: rejected for
// additionalProperties false, checked against its schema when it gives one, kept as they are otherwise. One without
// properties is a map, typed when the schema types its values.
function objectOf(property: JsonSchemaProperty): z.ZodType {
  const extra = property.additionalProperties;
  const values = typeof extra === "object" ? fieldOf(extra) : z.unknown();

  if (property.properties && Object.keys(property.properties).length > 0) {
    const object = z.object(shapeOf(property));

    return extra === false ? object.strict() : object.catchall(values);
  }

  return z.record(z.string(), values);
}

function bounded(number: z.ZodNumber, property: JsonSchemaProperty): z.ZodNumber {
  const min = typeof property.minimum === "number" ? number.min(property.minimum) : number;

  return typeof property.maximum === "number" ? min.max(property.maximum) : min;
}

function firstType(property: JsonSchemaProperty): string {
  const types = Array.isArray(property.type) ? property.type : [property.type ?? "string"];

  return types.find((type) => type !== "null") ?? (types.includes("null") ? "null" : "string");
}

function isNullable(property: JsonSchemaProperty): boolean {
  return (Array.isArray(property.type) && property.type.includes("null")) || (property.anyOf ?? []).some((option) => option.type === "null");
}
