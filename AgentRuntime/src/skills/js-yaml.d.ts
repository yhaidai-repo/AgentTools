declare module "js-yaml" {
  export const FAILSAFE_SCHEMA: unknown;
  export function load(text: string, options: { schema: unknown }): unknown;
}
