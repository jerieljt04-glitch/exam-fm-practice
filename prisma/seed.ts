import { examRepository } from "../lib/db";
import { QUESTION_TEMPLATES } from "../lib/engine/templates";
import { prisma } from "../lib/prisma";

async function main() {
  if (!prisma) {
    console.error("Prisma Client is not generated. Run `npm run prisma:generate` first.");
    process.exitCode = 1;
    return;
  }

  console.log(`Seeding ${QUESTION_TEMPLATES.length} question templates...`);
  await examRepository.seedTemplates();

  const count = await prisma.questionTemplate.count();
  console.log(`Done. questionTemplate rows in database: ${count}`);
}

main()
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (prisma) await prisma.$disconnect();
  });
