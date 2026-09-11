/**
 * Helper script to view tables and query the SQLite database
 * Run from the 'api' directory: npx ts-node src/scripts/viewDb.ts
 */
import db from "../db/database";

const run = () => {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📊 SQLite Database Viewer");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  try {
    // 1. List all tables
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    console.log("📁 Tables in Database:", tables.map(t => t.name).join(", "));
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // 2. Query each table count and print sample rows
    for (const { name } of tables) {
      if (name.startsWith("sqlite_")) continue;

      const { count } = db.prepare(`SELECT COUNT(*) as count FROM ${name}`).get() as { count: number };
      console.log(`Table: ${name} (${count} rows)`);

      if (count > 0) {
        const rows = db.prepare(`SELECT * FROM ${name} LIMIT 5`).all();
        console.table(rows);
      } else {
        console.log("(Empty Table)");
      }
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    }
  } catch (error) {
    console.error("❌ Error querying database:", error);
  }
};

run();
