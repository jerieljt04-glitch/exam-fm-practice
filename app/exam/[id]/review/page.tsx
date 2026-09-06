import { notFound } from "next/navigation";
import { examRepository } from "@/lib/db";
import { ExamReview } from "@/components/ExamReview";

export const dynamic = "force-dynamic";

export default async function ExamReviewPage({ params }: { params: { id: string } }) {
  const review = await examRepository.getReviewData(params.id);
  if (!review) notFound();

  return <ExamReview reviewData={review} />;
}
