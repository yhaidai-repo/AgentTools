// Decoded pixels: RGBA, row by row, 4 bytes per pixel.
export interface Raster {
  width: number;
  height: number;
  data: Buffer;
}
