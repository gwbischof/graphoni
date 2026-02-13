import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { users } from "./schema";

async function seed() {
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ||
      "postgresql://graphoni:graphoni_dev@localhost:5432/graphoni",
  });
  const db = drizzle(pool);

  const adminEmail = "admin@graphoni.local";

  // Check if admin exists
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, adminEmail))
    .limit(1);

  if (existing.length > 0) {
    console.log("Admin user already exists:", existing[0].email);
  } else {
    const [admin] = await db
      .insert(users)
      .values({
        email: adminEmail,
        name: "Admin",
        role: "admin",
      })
      .returning();
    console.log("Created admin user:", admin.email, admin.id);
  }

  // Also seed a mod user for dev
  const modEmail = "mod@graphoni.local";
  const existingMod = await db
    .select()
    .from(users)
    .where(eq(users.email, modEmail))
    .limit(1);

  if (existingMod.length === 0) {
    const [mod] = await db
      .insert(users)
      .values({
        email: modEmail,
        name: "Moderator",
        role: "mod",
      })
      .returning();
    console.log("Created mod user:", mod.email, mod.id);
  } else {
    console.log("Mod user already exists:", existingMod[0].email);
  }

  await pool.end();
  console.log("Seed complete.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
