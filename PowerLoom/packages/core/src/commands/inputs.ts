import { z } from "zod";
import { DEFAULT_PERIOD, PERIOD_KEYS } from "../periods";

// The inputs the read commands share (stage 2 of the powerloom-mcp design, 2026-10-23), described once so every tool
// explains them the same way.
export const vaultInput = z.string().trim().min(1).describe("The vault, e.g. work-projects (Settings lists them)");
export const periodInput = z.enum(PERIOD_KEYS).default(DEFAULT_PERIOD).describe("The period, as the pages' switch: 1h, today, week, sprint (the vault's current sprint) or 30d");
export const pbiIdInput = z.number().int().positive().describe("The PBI's id, e.g. 38519");
export const limitInput = (max: number, fallback: number) => z.number().int().min(1).max(max).default(fallback).describe(`Most rows to answer (up to ${max})`);
