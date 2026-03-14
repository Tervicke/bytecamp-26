import { connectNeo4j, closeNeo4j } from "../lib/neo4j/neo4j";
import { applySchema } from "../lib/neo4j/schema";
import { seedAll } from "../services/seed.service";

/**
 * Standalone script to recreate the Neo4j dataset
 * from the CSV files in the /seed folder.
 *
 * It:
 * 1. Connects to Neo4j
 * 2. Applies constraints and indexes
 * 3. Reads all CSVs under /seed and seeds:
 *    - Company, Person, BankAccount nodes
 *    - OWNS, SUBSIDIARY_OF, HOLDS_ACCOUNT, TRANSFERS_TO relationships
 */
async function main(): Promise<void> {
  await connectNeo4j();
  await applySchema();
  await seedAll();
  await closeNeo4j();
}

// Run when invoked directly (e.g. `node dist/db/seed.js`)
if (import.meta.main) {
  main()
    .then(() => {
      console.log("[Seed] ✅ Completed CSV → Neo4j seeding");
      // eslint-disable-next-line n/no-process-exit
      process.exit(0);
    })
    .catch((err) => {
      console.error("[Seed] ❌ Failed seeding from CSV", err);
      // eslint-disable-next-line n/no-process-exit
      process.exit(1);
    });
}

