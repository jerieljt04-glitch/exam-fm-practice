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

  // A sitting ends when its tab closes, so there is nothing to come back to.
  if (session.status === "ABANDONED") {
    redirect("/?closed=1");
  }

  return <ExamRunner initialSession={session} />;
}
