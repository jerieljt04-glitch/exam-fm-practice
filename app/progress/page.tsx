import { DataManagement } from "@/components/progress/DataManagement";
import { HistoryTable } from "@/components/progress/HistoryTable";
import { LinkTabs } from "@/components/progress/LinkTabs";
import {
  ConceptMasteryPanel,
  FormatsPanel,
  FormulaMasteryPanel,
  HypothesesPanel,
  ImprovementPanel,
  MisconceptionsPanel,
  OutcomesPanel,
  WeaknessesPanel,
} from "@/components/progress/panels";
import { ReadinessCard } from "@/components/progress/ReadinessCard";
import { ScoreTrendChart } from "@/components/progress/ScoreTrendChart";
import { Panel } from "@/components/ui";
import { getDashboard, PASS_MARK, scoreTrend, sessionHistory } from "@/lib/server/repository";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "mastery", label: "Mastery" },
  { id: "concepts", label: "Concepts" },
  { id: "formats", label: "Question formats" },
  { id: "history", label: "History & data" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default async function ProgressPage({ searchParams }: { searchParams: { tab?: string; page?: string } }) {
  const tab: Tab = TABS.some((t) => t.id === searchParams.tab) ? (searchParams.tab as Tab) : "overview";
  const d = await getDashboard();

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <header className="pt-4">
        <h1 className="font-display text-[30px] font-semibold sm:text-[32px]">Progress</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {d.totals.attempts} questions answered · figures update whenever a session is submitted
        </p>
      </header>
      <LinkTabs tabs={TABS} active={tab} base="/progress" />

      {tab === "overview" && <Overview d={d} />}
      {tab === "mastery" && (
        <div className="space-y-4">
          <OutcomesPanel d={d} />
          <FormulaMasteryPanel d={d} />
          <div className="grid gap-4 lg:grid-cols-2">
            <WeaknessesPanel d={d} />
            <HypothesesPanel d={d} />
          </div>
        </div>
      )}
      {tab === "concepts" && <ConceptMasteryPanel d={d} />}
      {tab === "formats" && <FormatsPanel d={d} />}
      {tab === "history" && <History page={Number(searchParams.page) || 1} />}
    </main>
  );
}

async function Overview({ d }: { d: Awaited<ReturnType<typeof getDashboard>> }) {
  const trend = await scoreTrend();
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel title="Score trend">
          <ScoreTrendChart points={trend} passMark={PASS_MARK} />
        </Panel>
        <ReadinessCard readiness={d.readiness} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <ImprovementPanel d={d} />
        <MisconceptionsPanel d={d} />
        <WeaknessesPanel d={d} />
      </div>
    </div>
  );
}

async function History({ page }: { page: number }) {
  const h = await sessionHistory(page);
  return (
    <div className="space-y-4">
      <Panel title={`Completed sessions (${h.total})`}>
        <HistoryTable rows={h.rows} page={h.page} pages={h.pages} total={h.total} base="/progress?tab=history" />
      </Panel>
      <DataManagement />
    </div>
  );
}
