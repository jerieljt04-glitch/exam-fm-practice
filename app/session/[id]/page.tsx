import { notFound, redirect } from "next/navigation";

import { SessionRunner } from "@/components/session/SessionRunner";
import { getSessionView } from "@/lib/server/repository";

export const dynamic = "force-dynamic";

export default async function SessionPage({ params }: { params: { id: string } }) {
  const view = await getSessionView(params.id);
  if (!view) notFound();
  if (view.status === "SUBMITTED") redirect(`/session/${params.id}/report`);
  return <SessionRunner initial={view} />;
}
