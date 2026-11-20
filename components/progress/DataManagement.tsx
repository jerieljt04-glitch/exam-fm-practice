"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload } from "lucide-react";

import { ResetHistory } from "@/components/dashboard/Actions";
import { Button, Modal, Panel } from "@/components/ui";

/** Back up, restore or erase your history. */
export function DataManagement() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ name: string; backup: unknown; sessions: number } | null>(null);
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const choose = async (file: File | undefined) => {
    setStatus(null);
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text()) as { format?: string; sessions?: unknown[] };
      if (backup.format !== "exam-fm-practice-backup" || !Array.isArray(backup.sessions)) throw new Error("This file is not an Exam FM Practice backup.");
      setPending({ name: file.name, backup, sessions: backup.sessions.length });
    } catch (e) {
      setStatus({ tone: "error", text: e instanceof SyntaxError ? "The file is not valid JSON." : (e as Error).message });
    } finally {
      if (input.current) input.current.value = "";
    }
  };

  const restore = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const res = await fetch("/api/backup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "REPLACE_ALL_HISTORY", backup: pending.backup }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Restore failed.");
      setStatus({ tone: "ok", text: `Restored ${data.sessions} sessions. Your previous history was saved to ${data.safetyCopy}.` });
      setPending(null);
      router.refresh();
    } catch (e) {
      setStatus({ tone: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Your data">
      <p className="text-sm text-muted-foreground">Everything stays on this computer. Download a backup to keep a copy or move your history to another machine.</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <a href="/api/backup" download className="inline-flex h-10 items-center gap-2 rounded-pill bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary-hover">
          <Download size={16} strokeWidth={1.75} aria-hidden /> Download backup
        </a>
        <Button variant="outlined" onClick={() => input.current?.click()}>
          <Upload size={16} strokeWidth={1.75} aria-hidden /> Restore from backup…
        </Button>
        <input ref={input} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void choose(e.target.files?.[0])} aria-label="Backup file" />
        <ResetHistory />
      </div>
      {status && (
        <p role="status" className={status.tone === "ok" ? "mt-3 rounded-field bg-success-container px-4 py-2 text-sm text-success" : "mt-3 rounded-field bg-destructive-container px-4 py-2 text-sm text-destructive"}>
          {status.text}
        </p>
      )}
      <Modal
        open={pending !== null}
        onClose={() => setPending(null)}
        title="Replace your history with this backup?"
        footer={
          <>
            <Button variant="outlined" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void restore()} disabled={busy}>
              {busy ? "Restoring…" : "Replace history"}
            </Button>
          </>
        }
      >
        {pending && (
          <>
            <strong className="text-foreground">{pending.name}</strong> holds {pending.sessions} sessions. Your current sessions, remediation and study progress will be replaced by it. A copy of your current history is saved first, next to the database.
          </>
        )}
      </Modal>
    </Panel>
  );
}
