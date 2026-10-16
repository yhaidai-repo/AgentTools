import { z } from "zod";

// The inputs every chat SQL command shares: which vault's Read SQL, and which of its connections.
export const sqlVaultInput = z.string().trim().min(1).describe("The vault whose Read SQL connections to use, e.g. work-projects");
export const sqlConnectionInput = z.string().trim().min(1).describe("The connection's name as Settings > Read SQL shows it");
