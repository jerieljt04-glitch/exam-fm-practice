import { notFound, redirect } from "next/navigation";
import { examRepository } from "@/lib/db";
import { ExamRunner } from "@/components/ExamRunner";

export const dynamic = "force-dynamic";

export default async function ExamPage({ params }: { params: { id: string } }) {
  const session = await examRepository.getExamSession(params.id);
  if (!session) notFound();

  if (session.status === "COMPLETED") {
    redirect(`/exam/${params.id}/review`);
  }

  return <ExamRunner initialSession={session} />;
}
