import { seedSample } from "../lib/seed";
import { db } from "../lib/db";

seedSample()
  .then((added) => console.log(added.length ? `Seeded sample ${added.join(", ")}.` : "Sample data already present."))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
