"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Modal } from "@/components/ui";
import { cn } from "@/lib/utils";

type Mode = "DIAGNOSTIC" | "EXAM" | "CHALLENGE" | "PRACTICE";

const BUCKETS = [
  { id: "single", label: "Single formula" },
  { id: "pair", label: "Two formulas" },
  { id: "multi", label: "Three or more" },
  { id: "reconstruct", label: "Reconstruct / derive" },
] as const;

function useStarter() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const start = async (key: string, url: string, body?: unknown) => {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start.");
      router.push(`/session/${data.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  };
  return { busy, error, start };
}

const select = "h-9 rounded-md border bg-card px-2 text-sm";

export function StartPanel({ llm }: { llm: boolean }) {
  const { busy, error, start } = useStarter();
  const [dCount, setDCount] = useState(15);
  const [dLevel, setDLevel] = useState("mixed");
  const [eLevel, setELevel] = useState("1");
  const [cCount, setCCount] = useState(10);
  const [cTimed, setCTimed] = useState(false);
  const [ai, setAi] = useState(false);
  const [pCount, setPCount] = useState(10);
  const [pRef, setPRef] = useState<"integration" | "supported">("integration");
  const [mix, setMix] = useState<Record<string, number>>({ single: 20, pair: 40, multi: 30, reconstruct: 10 });
  const mixTotal = Object.values(mix).reduce((a, b) => a + b, 0);

  const go = (mode: Mode, body: Record<string, unknown>) => void start(mode, "/api/sessions", { mode, aiWording: ai, ...body });

  return (
    <div className="space-y-3">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="panel flex flex-col p-4">
          <div className="eyebrow">Mode A</div>
          <h3 className="text-lg font-semibold">Diagnostic</h3>
          <p className="mt-1 flex-1 text-sm text-muted-foreground">
            Untimed, mixed and unlabelled. Measures reasoning, not speed; leans toward skills your history has not tested yet.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-1">
              Questions
              <select className={select} value={dCount} onChange={(e) => setDCount(Number(e.target.value))}>
                {[5, 10, 15, 20, 25, 30].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1">
              Difficulty
              <select className={select} value={dLevel} onChange={(e) => setDLevel(e.target.value)}>
                <option value="mixed">Mixed</option>
                <option value="1">SOA standard</option>
                <option value="2">Advanced</option>
                <option value="3">Challenge</option>
              </select>
            </label>
          </div>
          <Button className="mt-3" onClick={() => go("DIAGNOSTIC", { count: dCount, difficulty: dLevel })} disabled={busy !== null}>
            {busy === "DIAGNOSTIC" ? "Generating and validating…" : "Start diagnostic"}
          </Button>
        </div>

        <div className="panel flex flex-col p-4">
          <div className="eyebrow">Mode B</div>
          <h3 className="text-lg font-semibold">Exam simulation</h3>
          <p className="mt-1 flex-1 text-sm text-muted-foreground">
            30 questions, 150 minutes, five options, weighted 3 / 7 / 6 / 6 / 8 across the syllabus. No feedback until you submit.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-1">
              Difficulty
              <select className={select} value={eLevel} onChange={(e) => setELevel(e.target.value)}>
                <option value="1">SOA standard</option>
                <option value="mixed">Mixed</option>
                <option value="2">Advanced</option>
              </select>
            </label>
          </div>
          <Button className="mt-3" onClick={() => go("EXAM", { difficulty: eLevel })} disabled={busy !== null}>
            {busy === "EXAM" ? "Generating and validating…" : "Start exam simulation"}
          </Button>
        </div>

        <div className="panel flex flex-col p-4">
          <div className="eyebrow">Above exam level</div>
          <h3 className="text-lg font-semibold">Challenge</h3>
          <p className="mt-1 flex-1 text-sm text-muted-foreground">
            Harder-than-exam reasoning inside the syllabus: hidden structure, chained concepts, equations built from scratch. Scored separately.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-1">
              Questions
              <select className={select} value={cCount} onChange={(e) => setCCount(Number(e.target.value))}>
                {[5, 8, 10, 12, 15].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={cTimed} onChange={(e) => setCTimed(e.target.checked)} /> 5 min per question
            </label>
          </div>
          <Button className="mt-3" onClick={() => go("CHALLENGE", { count: cCount, difficulty: 3, timed: cTimed })} disabled={busy !== null}>
            {busy === "CHALLENGE" ? "Generating and validating…" : "Start challenge"}
          </Button>
        </div>
      </div>
      <div className="panel p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <div className="eyebrow">Formula integration</div>
            <h3 className="text-lg font-semibold">Formula practice</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Questions chosen by how many formulas they connect, from a single formula up to problems that must be rebuilt from first principles. After submitting, each question shows its formula chain and the step where any mistake happened. Diagnostics, exams and challenges are always closed-book.
            </p>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1">
                Questions
                <select className={select} value={pCount} onChange={(e) => setPCount(Number(e.target.value))}>
                  {[5, 10, 15, 20].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1">
                Reference
                <select className={select} value={pRef} onChange={(e) => setPRef(e.target.value as typeof pRef)}>
                  <option value="integration">Hidden — chain revealed after submitting</option>
                  <option value="supported">Formula library open while working</option>
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-4">
              {BUCKETS.map((b) => (
                <label key={b.id} className="flex flex-col text-xs text-muted-foreground">
                  {b.label}
                  <span className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={5}
                      value={mix[b.id]}
                      onChange={(e) => setMix((m) => ({ ...m, [b.id]: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }))}
                      className="h-8 w-16 rounded-md border bg-card px-2 text-sm text-foreground"
                      aria-label={`${b.label} percentage`}
                    />
                    %
                  </span>
                </label>
              ))}
            </div>
            <p className={cn("text-xs", mixTotal === 100 ? "text-muted-foreground" : "text-warning")}>
              {mixTotal === 100 ? "Default mix 20 / 40 / 30 / 10." : `Shares add to ${mixTotal}%; they will be scaled to 100%.`}
            </p>
            <Button onClick={() => go("PRACTICE", { count: pCount, reference: pRef, integrationMix: mix })} disabled={busy !== null || mixTotal === 0}>
              {busy === "PRACTICE" ? "Generating and validating…" : "Start formula practice"}
            </Button>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {llm ? (
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={ai} onChange={(e) => setAi(e.target.checked)} />
            Vary question wording with the language model (numbers and mathematics are checked to be unchanged)
          </label>
        ) : (
          <span>Language-model wording: not configured — every question comes from the built-in, validated bank.</span>
        )}
        {error && <span className="text-destructive">{error}</span>}
      </div>
    </div>
  );
}

export function RemediationButton({ due }: { due: number }) {
  const { busy, error, start } = useStarter();
  return (
    <div>
      <Button onClick={() => void start("rem", "/api/remediation")} disabled={due === 0 || busy !== null}>
        {busy ? "Generating…" : due ? `Start remediation set (${due} due)` : "Nothing due"}
      </Button>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function ResetHistory() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const reset = async () => {
    await fetch("/api/history", { method: "DELETE" });
    setOpen(false);
    router.refresh();
  };
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Reset all history
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Delete all history?"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void reset()}>
              Delete everything
            </Button>
          </>
        }
      >
        Every session, answer, remediation item and validation record will be permanently deleted. Mastery and the diagnostic profile start again from the initial hypotheses.
      </Modal>
    </>
  );
}
