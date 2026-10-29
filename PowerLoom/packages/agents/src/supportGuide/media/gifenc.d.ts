// gifenc ships no types; only what encodeGif uses.
declare module "gifenc" {
  export type Palette = number[][];

  export interface Encoder {
    writeFrame(index: Uint8Array, width: number, height: number, options?: { palette?: Palette; delay?: number; repeat?: number; dispose?: number }): void;
    finish(): void;
    bytes(): Uint8Array;
  }

  export function GIFEncoder(): Encoder;
  export function quantize(rgba: Uint8Array, maxColors: number): Palette;
  export function applyPalette(rgba: Uint8Array, palette: Palette): Uint8Array;

  const gifenc: { GIFEncoder: typeof GIFEncoder; quantize: typeof quantize; applyPalette: typeof applyPalette };
  export default gifenc;
}
