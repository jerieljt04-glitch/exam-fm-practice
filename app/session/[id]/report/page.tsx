import { notFound, redirect } from "next/navigation";

import { ReportView } from "@/components/report/ReportView";
import { isDue } from "@/lib/analysis/remediation";
import { getReport, getSessionView, loadRemediationItems } from "@/lib/server/repository";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params, searchParams }: { params: { id: string }; searchParams: { tab?: string; q?: string } }) {
  const report = await getReport(params.id);
  if (!report) {
    const view = await getSessionView(params.id);
    if (!view) notFound();
    redirect(`/session/${params.id}`);
  }
  const now = new Date();
  const remediationDue = (await loadRemediationItems()).filter((item) => isDue(item, now)).length;
  return <ReportView report={report} remediationDue={remediationDue} initialTab={searchParams.tab} initialQuestion={searchParams.q ? Number(searchParams.q) : undefined} />;
}
