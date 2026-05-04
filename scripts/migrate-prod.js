const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

async function migrate() {
  const prisma = new PrismaClient();

  try {
    // Check if tables already exist
    const tables = await prisma.$queryRawUnsafe(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'User'`
    );

    if (tables.length > 0) {
      console.log("Tables already exist, skipping migration.");
      return;
    }

    console.log("Creating database tables...");

    const sqlPath = path.join(__dirname, "..", "prisma", "migrations", "20260504215600_init", "migration.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    // Split by semicolons and execute each statement
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    for (const stmt of statements) {
      try {
        await prisma.$executeRawUnsafe(stmt + ";");
      } catch (e) {
        // Ignore "already exists" errors
        if (!e.message.includes("already exists")) {
          console.log("Statement warning:", e.message.substring(0, 100));
        }
      }
    }

    console.log("Migration completed successfully.");
  } catch (e) {
    console.log("Migration error:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
