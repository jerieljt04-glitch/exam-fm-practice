"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface UseExamTimerOptions {
  durationSeconds?: number; // default 9000 (150 minutes)
  startTime: string; // ISO string
  initialPausedTimeMs?: number;
  initialIsPaused?: boolean;
  onTimeExpire?: () => void;
  onPauseToggle?: (isPaused: boolean) => Promise<void>;
}

export function useExamTimer({
  durationSeconds = 9000,
  startTime,
  initialPausedTimeMs = 0,
  initialIsPaused = false,
  onTimeExpire,
  onPauseToggle,
}: UseExamTimerOptions) {
  const [isPaused, setIsPaused] = useState<boolean>(initialIsPaused);
  const [pausedTimeMs, setPausedTimeMs] = useState<number>(initialPausedTimeMs);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(durationSeconds);
  const [isExpired, setIsExpired] = useState<boolean>(false);

  const pauseStartRef = useRef<number | null>(initialIsPaused ? Date.now() : null);
  const onTimeExpireRef = useRef(onTimeExpire);
  onTimeExpireRef.current = onTimeExpire;

  // Calculates remaining seconds based on real clock timestamps
  const calculateTimeRemaining = useCallback(() => {
    const startMs = new Date(startTime).getTime();
    const nowMs = Date.now();

    let currentSessionPausedMs = pausedTimeMs;
    if (isPaused && pauseStartRef.current) {
      currentSessionPausedMs += nowMs - pauseStartRef.current;
    }

    const elapsedTotalMs = nowMs - startMs;
    const activeElapsedMs = Math.max(0, elapsedTotalMs - currentSessionPausedMs);
    const activeElapsedSeconds = Math.floor(activeElapsedMs / 1000);
    const left = Math.max(0, durationSeconds - activeElapsedSeconds);

    return left;
  }, [startTime, pausedTimeMs, isPaused, durationSeconds]);

  // Main tick interval
  useEffect(() => {
    if (isExpired) return;

    const tick = () => {
      const left = calculateTimeRemaining();
      setRemainingSeconds(left);

      if (left <= 0 && !isExpired) {
        setIsExpired(true);
        onTimeExpireRef.current?.();
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [calculateTimeRemaining, isExpired]);

  // Toggle pause/resume
  const togglePause = useCallback(async () => {
    const nextIsPaused = !isPaused;
    const now = Date.now();

    if (nextIsPaused) {
      // Pausing
      pauseStartRef.current = now;
      setIsPaused(true);
    } else {
      // Resuming
      if (pauseStartRef.current) {
        const addedPausedMs = now - pauseStartRef.current;
        setPausedTimeMs((prev) => prev + addedPausedMs);
        pauseStartRef.current = null;
      }
      setIsPaused(false);
    }

    if (onPauseToggle) {
      try {
        await onPauseToggle(nextIsPaused);
      } catch (err) {
        console.error("Failed to sync pause state with server:", err);
      }
    }
  }, [isPaused, onPauseToggle]);

  // Format as HH:MM:SS
  const formatTime = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  // Visual status
  const isWarning = remainingSeconds < 600 && remainingSeconds >= 300; // Under 10 mins
  const isCritical = remainingSeconds < 300; // Under 5 mins

  return {
    remainingSeconds,
    formattedTime: formatTime(remainingSeconds),
    isPaused,
    pausedTimeMs,
    togglePause,
    isWarning,
    isCritical,
    isExpired,
  };
}
