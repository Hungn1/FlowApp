// Runs before `npm run dev`: creates/updates the local SQLite database and,
// the very first time only, loads the sample data.
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";

const dbFile = new URL("../prisma/applyflow.db", import.meta.url);
const firstRun = !existsSync(dbFile);
const run = (cmd) => execSync(cmd, { stdio: "inherit" });

run("npx prisma migrate deploy");
if (firstRun) {
  console.log("First run: loading sample data…");
  run("npx tsx prisma/seed.ts");
}
