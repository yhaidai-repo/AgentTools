import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "../schema";

export type PowerLoomDb = NodePgDatabase<typeof schema>;
