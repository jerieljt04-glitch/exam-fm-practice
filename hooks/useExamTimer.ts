"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { EXAM_DURATION_SECONDS } from "@/lib/exam-config";

export interface UseExamTimerOptions {
  /** Total active exam time. Defaults to 9000 seconds (150 minutes). */
  durationSeconds?: number;
  /** ISO timestamp at which the sitting started. */
  startTime: string;
  /** Paused milliseconds already accumulated on the server. */
  initialPausedTimeMs?: number;
  initialIsPaused?: boolean;
  /** ISO timestamp of an in-flight pause carried over from the server. */
  initialLastPausedAt?: string | null;
  onTimeExpire?: () => void;
  /** Persists the new pause state; a rejection rolls the toggle back. */
  onPauseToggle?: (isPaused: boolean) => Promise<void>;
}

export interface ExamTimerState {
  remainingSeconds: number;
  /** `HH:MM:SS`. */
  formattedTime: string;
  isPaused: boolean;
  isSyncing: boolean;
  pausedTimeMs: number;
  /** Percentage of the allotted time already consumed, 0–100. */
  elapsedPercent: number;
  togglePause: () => Promise<void>;
  /** Under 10 minutes remaining. */
  isWarning: boolean;
  /** Under 5 minutes remaining. */
  isCritical: boolean;
  isExpired: boolean;
}

const WARNING_THRESHOLD_SECONDS = 10 * 60;
const CRITICAL_THRESHOLD_SECONDS = 5 * 60;

function formatTime(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Countdown clock for the CBT session.
 *
 * Remaining time is always recomputed from wall-clock timestamps rather than by
 * decrementing a counter, so a backgrounded tab, a throttled interval or a page
 * reload cannot hand the candidate extra time — or take any away. Paused
 * intervals are accumulated in `pausedTimeMs` and excluded from elapsed time.
 */
export function useExamTimer({
  durationSeconds = EXAM_DURATION_SECONDS,
  startTime,
  initialPausedTimeMs = 0,
  initialIsPaused = false,
  initialLastPausedAt = null,
  onTimeExpire,
  onPauseToggle,
}: UseExamTimerOptions): ExamTimerState {
  const [isPaused, setIsPaused] = useState(initialIsPaused);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pausedTimeMs, setPausedTimeMs] = useState(initialPausedTimeMs);
  const [remainingSeconds, setRemainingSeconds] = useState(durationSeconds);
  const [isExpired, setIsExpired] = useState(false);

  // Timestamp at which the current pause began, or null while running.
  const pauseStartedAtRef = useRef<number | null>(
    initialIsPaused ? (initialLastPausedAt ? new Date(initialLastPausedAt).getTime() : Date.now()) : null
  );
  const onTimeExpireRef = useRef(onTimeExpire);
  onTimeExpireRef.current = onTimeExpire;

  const computeRemaining = useCallback(() => {
    const startMs = new Date(startTime).getTime();
    const now = Date.now();

    let pausedMs = pausedTimeMs;
    if (isPaused && pauseStartedAtRef.current !== null) {
      pausedMs += now - pauseStartedAtRef.current;
    }

    const activeElapsedMs = Math.max(0, now - startMs - pausedMs);
    return Math.max(0, durationSeconds - Math.floor(activeElapsedMs / 1000));
  }, [durationSeconds, isPaused, pausedTimeMs, startTime]);

  useEffect(() => {
    if (isExpired) return;

    const tick = () => {
      const remaining = computeRemaining();
      setRemainingSeconds(remaining);
      if (remaining <= 0) {
        setIsExpired(true);
        onTimeExpireRef.current?.();
      }
    };

    tick();
    const interval = window.setInterval(tick, 1000);

    // Browsers throttle timers in background tabs; resync the moment the
    // candidate returns so the clock never appears to have stalled.
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [computeRemaining, isExpired]);

  const togglePause = useCallback(async () => {
    if (isExpired || isSyncing) return;

    const nextIsPaused = !isPaused;
    const now = Date.now();
    const previousPausedTimeMs = pausedTimeMs;
    const previousPauseStartedAt = pauseStartedAtRef.current;

    if (nextIsPaused) {
      pauseStartedAtRef.current = now;
    } else if (pauseStartedAtRef.current !== null) {
      setPausedTimeMs((previous) => previous + (now - (pauseStartedAtRef.current ?? now)));
      pauseStartedAtRef.current = null;
    }
    setIsPaused(nextIsPaused);

    if (!onPauseToggle) return;

    setIsSyncing(true);
    try {
      await onPauseToggle(nextIsPaused);
    } catch (error) {
      // Roll back so the client clock cannot drift away from the server's.
      console.error("Failed to persist pause state; reverting.", error);
      setIsPaused(!nextIsPaused);
      setPausedTimeMs(previousPausedTimeMs);
      pauseStartedAtRef.current = previousPauseStartedAt;
    } finally {
      setIsSyncing(false);
    }
  }, [isExpired, isPaused, isSyncing, onPauseToggle, pausedTimeMs]);

  const elapsedPercent = useMemo(() => {
    if (durationSeconds <= 0) return 100;
    return Math.min(100, Math.max(0, ((durationSeconds - remainingSeconds) / durationSeconds) * 100));
  }, [durationSeconds, remainingSeconds]);

  return {
    remainingSeconds,
    formattedTime: formatTime(remainingSeconds),
    isPaused,
    isSyncing,
    pausedTimeMs,
    elapsedPercent,
    togglePause,
    isWarning: remainingSeconds < WARNING_THRESHOLD_SECONDS && remainingSeconds >= CRITICAL_THRESHOLD_SECONDS,
    isCritical: remainingSeconds < CRITICAL_THRESHOLD_SECONDS,
    isExpired,
  };
}
