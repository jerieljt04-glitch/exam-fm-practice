import { prisma } from "../lib/prisma";
import { QUESTION_TEMPLATES } from "../lib/engine/templates";

async function main() {
  if (!prisma) {
    console.log("Prisma client not yet generated. Please run `npx prisma generate` first.");
    return;
  }

  console.log("Seeding Question Templates for SOA Exam FM...");

  for (const t of QUESTION_TEMPLATES) {
    const sample = t.generate();
    await prisma.questionTemplate.upsert({
      where: { id: t.id },
      update: {
        domain: t.domain,
        templateText: sample.questionText,
        solutionSteps: sample.solutionSteps,
        videoUrl: sample.videoUrl,
        parameterSchema: sample.variables,
      },
      create: {
        id: t.id,
        domain: t.domain,
        templateText: sample.questionText,
        solutionSteps: sample.solutionSteps,
        videoUrl: sample.videoUrl,
        parameterSchema: sample.variables,
      },
    });
    console.log(`- Seeded template: ${t.id} (${t.domain})`);
  }

  console.log("Seeding completed successfully.");
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });
