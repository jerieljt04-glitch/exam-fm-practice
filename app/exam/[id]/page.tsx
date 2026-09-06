import { notFound, redirect } from "next/navigation";
import { examRepository } from "@/lib/db";
import { ExamRunner } from "@/components/ExamRunner";

interface ExamPageProps {
  params: { id: string };
}

export const revalidate = 0; // Dynamic route

export default async function ExamPage({ params }: ExamPageProps) {
  const session = await examRepository.getExamSession(params.id);

  if (!session) {
    notFound();
  }

  // If already completed, redirect to review
  if (session.status === "COMPLETED") {
    redirect(`/exam/${params.id}/review`);
  }

  return <ExamRunner initialSession={session} />;
}
