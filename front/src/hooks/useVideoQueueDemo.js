import { useCallback, useEffect, useMemo, useState } from "react";

const randomBetween = (min, max) => Math.round(Math.random() * (max - min) + min);

export const createDemoVideoJobs = () =>
  Array.from({ length: 5 }).map((_, idx) => {
    const durationMs = randomBetween(12000, 28000);
    return {
      id: idx + 1,
      status: "processing",
      startedAt: Date.now(),
      durationMs,
      remainingSeconds: Math.ceil(durationMs / 1000),
      progress: randomBetween(8, 22),
    };
  });

/**
 * Demo queue for video generation until the real API is wired.
 * Keeps ticking while enabled; resets when toggled off/on.
 */
export function useVideoQueueDemo(enabled = false) {
  const [jobs, setJobs] = useState(() => (enabled ? createDemoVideoJobs() : []));
  const [cycleKey, setCycleKey] = useState(0);

  // Reset and bootstrap when turned on/off
  useEffect(() => {
    if (!enabled) {
      setJobs([]);
      return;
    }
    setJobs(createDemoVideoJobs());
    setCycleKey((k) => k + 1);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || jobs.length === 0) return;

    const interval = setInterval(() => {
      setJobs((prev) => {
        let finished = 0;

        const next = prev.map((job) => {
          if (job.status === "done") {
            finished += 1;
            return job;
          }

          const now = Date.now();
          const elapsed = now - job.startedAt;
          const remainingMs = Math.max(0, job.durationMs - elapsed);

          if (remainingMs <= 0) {
            finished += 1;
            return { ...job, status: "done", progress: 100, remainingSeconds: 0 };
          }

          const baseProgress = Math.round((elapsed / job.durationMs) * 100);
          const jitter = Math.random() < 0.35 ? 2 : 0;
          const nextProgress = Math.min(99, Math.max(job.progress, baseProgress + jitter));

          return {
            ...job,
            progress: nextProgress,
            remainingSeconds: Math.max(0, Math.ceil(remainingMs / 1000)),
          };
        });

        if (finished === prev.length) {
          clearInterval(interval);
        }

        return next;
      });
    }, 700);

    return () => clearInterval(interval);
  }, [enabled, cycleKey, jobs.length]);

  const restart = useCallback(() => {
    if (!enabled) return;
    setJobs(createDemoVideoJobs());
    setCycleKey((k) => k + 1);
  }, [enabled]);

  const processingCount = useMemo(
    () => jobs.filter((job) => job.status !== "done").length,
    [jobs]
  );
  const readyCount = useMemo(
    () => jobs.filter((job) => job.status === "done").length,
    [jobs]
  );

  return {
    jobs,
    restart,
    processingCount,
    readyCount,
    total: jobs.length,
  };
}
