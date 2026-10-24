import { z } from "zod";

// The inputs the chat SQL commands share: which vault's Read SQL, which of its connections, and which database of that
// connection's server when it isn't the connection's own.
export const sqlVaultInput = z.string().trim().min(1).describe("The vault whose Read SQL connections to use, e.g. work-projects");
export const sqlConnectionInput = z.string().trim().min(1).describe("The connection's name as Settings > Read SQL shows it");
export const sqlDatabaseInput = z.string().trim().min(1).optional().describe("Another database of the connection's server, e.g. Pvs_Stage; leave out for the connection's own. sql_databases lists them.");
