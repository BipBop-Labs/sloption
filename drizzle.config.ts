import { defineConfig } from "drizzle-kit";
export default defineConfig({
  // Cada dominio define sus tablas en su models.ts.
  schema: "./src/backend/domains/*/models.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
