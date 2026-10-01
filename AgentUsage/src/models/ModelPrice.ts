// $ per million tokens for one model, valid from `from` (ISO date) until a newer entry.
export interface ModelPrice {
  model: string;
  from: string;
  inputPerMTok: number;
  outputPerMTok: number;
  cacheReadPerMTok: number;
  cacheWritePerMTok: number;
}
