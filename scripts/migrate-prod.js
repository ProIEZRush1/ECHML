const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const MIGRATIONS_DIR = path.join(__dirname, "..", "prisma", "migrations");

async function migrate() {
  const prisma = new PrismaClient();

  try {
    // Ensure _prisma_migrations table exists
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id" VARCHAR(36) NOT NULL PRIMARY KEY,
        "checksum" VARCHAR(64) NOT NULL,
        "finished_at" TIMESTAMPTZ,
        "migration_name" VARCHAR(255) NOT NULL,
        "logs" TEXT,
        "rolled_back_at" TIMESTAMPTZ,
        "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "applied_steps_count" INTEGER NOT NULL DEFAULT 0
      );
    `);

    // Get already-applied migrations
    const applied = await prisma.$queryRawUnsafe(
      `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`
    );
    const appliedNames = new Set(applied.map((r) => r.migration_name));

    // Get all migration directories (sorted)
    const dirs = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((d) => {
        const fullPath = path.join(MIGRATIONS_DIR, d, "migration.sql");
        return fs.existsSync(fullPath);
      })
      .sort();

    let applied_count = 0;
    for (const dir of dirs) {
      if (appliedNames.has(dir)) continue;

      const sqlPath = path.join(MIGRATIONS_DIR, dir, "migration.sql");
      const sql = fs.readFileSync(sqlPath, "utf8");

      console.log(`Applying migration: ${dir}`);

      const statements = sql
        .split(";")
        .map((s) => s.trim())
        .map((s) => s.split("\n").filter((line) => !line.trimStart().startsWith("--")).join("\n").trim())
        .filter((s) => s.length > 0);

      for (const stmt of statements) {
        try {
          await prisma.$executeRawUnsafe(stmt + ";");
        } catch (e) {
          if (!e.message.includes("already exists")) {
            console.log(`  Warning: ${e.message.substring(0, 120)}`);
          }
        }
      }

      // Record migration as applied
      const id = require("crypto").randomUUID();
      await prisma.$executeRawUnsafe(
        `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, applied_steps_count)
         VALUES ($1, $2, NOW(), $3, 1)`,
        id,
        "manual",
        dir
      );

      applied_count++;
      console.log(`  Migration ${dir} applied.`);
    }

    if (applied_count === 0) {
      console.log("All migrations already applied.");
    } else {
      console.log(`Applied ${applied_count} migration(s).`);
    }
  } catch (e) {
    console.log("Migration error:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
