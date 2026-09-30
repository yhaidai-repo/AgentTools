import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath } from "node:url";
import { createDb } from "./index.js";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

const { db, pool } = createDb();
try {
  await migrate(db, { migrationsFolder });
  console.log("migrations applied");
} finally {
  await pool.end();
}
