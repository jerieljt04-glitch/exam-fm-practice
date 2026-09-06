import { notFound } from "next/navigation";
import { examRepository } from "@/lib/db";
import { ExamReview } from "@/components/ExamReview";

interface ExamReviewPageProps {
  params: { id: string };
}

export const revalidate = 0; // Dynamic route

export default async function ExamReviewPage({ params }: ExamReviewPageProps) {
  const session = await examRepository.getExamSession(params.id);

  if (!session) {
    notFound();
  }

  // Ensure exam is submitted and get review data
  const reviewData = await examRepository.submitExam(params.id);

  return <ExamReview reviewData={reviewData} />;
}
