const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

async function seed() {
  const prisma = new PrismaClient();

  try {
    const existingUser = await prisma.user.findFirst();
    if (existingUser) {
      console.log("Database already seeded, skipping.");
      return;
    }

    console.log("Seeding production database...");

    const passwordHash = await bcrypt.hash("Eduardo2006!", 10);
    await prisma.user.create({
      data: {
        email: "edumaucherni@gmail.com",
        name: "Eduardo",
        passwordHash,
        role: "ADMIN",
      },
    });
    console.log("Admin user created: edumaucherni@gmail.com");
  } catch (e) {
    console.log("Seed error (may be normal on first run):", e.message);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
