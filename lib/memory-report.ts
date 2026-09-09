// Periodic memory reporting for the long-lived web process.
//
// A container memory panel plots one number, and that number cannot distinguish
// the three things it might mean. A process that retains 9 KB per poll, one that
// retains nothing but is allowed to fill a large heap before V8 bothers to
// collect, and a service being redeployed every hour all draw rising lines on
// the same axis, and only the first is a leak. Deciding between them from
// outside the process is guesswork; from inside it is four figures.
//
//   heapUsedMb   Its *floor* across samples — the low point right after each
//                major collection — is what is actually retained. A floor that
//                rises day over day is a leak. A floor that returns to where it
//                started while heapTotal and rss climb is not.
//   heapTotalMb  What V8 has committed. Rises with garbage, not with retention.
//   heapLimitMb  V8's old-space ceiling, next to containerLimitMb. When the
//                ceiling is the larger of the two, V8 has no reason to collect
//                before the platform kills the container, and a rising line may
//                be nothing but that.
//   uptimeSec    Resets to ~0 on every deploy, which is what separates a
//                restart from a leak on a panel where both look like a cliff.
//
// Sample often enough and `min(heapUsedMb)` over a window approximates the
// retention floor closely enough to settle it on the same panel that raised the
// question. Costs one line a minute and one timer that never holds the process
// open.
import fs from "node:fs";
import v8 from "node:v8";

import { containerMemoryLimitBytes, type LimitFileReader } from "./heap-limit";

/** How often to report when `MEMORY_REPORT_INTERVAL_MS` says nothing. */
export const DEFAULT_REPORT_INTERVAL_MS = 60_000;

export interface MemorySample {
  rssBytes: number;
  heapUsedBytes: number;
  heapTotalBytes: number;
  externalBytes: number;
  arrayBuffersBytes: number;
  /** V8's own old-space ceiling — what `--max-old-space-size` actually became. */
  heapLimitBytes: number;
  /** The container's ceiling, or null when this is not running under one. */
  containerLimitBytes: number | null;
  uptimeSeconds: number;
}

/** Read a cgroup limit file, reporting "absent" for every failure to read one. */
const readLimitFile: LimitFileReader = (path) => {
  try {
    return fs.readFileSync(path, "utf8");
  } catch {
    return null;
  }
};

/**
 * Reporting interval in milliseconds; `0` disables reporting entirely.
 *
 * A malformed value falls back to the default rather than to silence: this is
 * the signal that says whether a memory panel is showing a leak, and a typo
 * should not be able to turn it off.
 */
export function reportIntervalMs(
  env: Readonly<Record<string, string | undefined>> = process.env,
): number {
  const raw = env.MEMORY_REPORT_INTERVAL_MS;
  if (raw === undefined) return DEFAULT_REPORT_INTERVAL_MS;
  if (!/^\d+$/.test(raw.trim())) return DEFAULT_REPORT_INTERVAL_MS;
  const value = Number(raw.trim());
  return Number.isSafeInteger(value) ? value : DEFAULT_REPORT_INTERVAL_MS;
}

/** Everything this process currently knows about its own memory. */
export function sampleMemory(read: LimitFileReader = readLimitFile): MemorySample {
  const usage = process.memoryUsage();
  return {
    rssBytes: usage.rss,
    heapUsedBytes: usage.heapUsed,
    heapTotalBytes: usage.heapTotal,
    externalBytes: usage.external,
    arrayBuffersBytes: usage.arrayBuffers,
    heapLimitBytes: v8.getHeapStatistics().heap_size_limit,
    containerLimitBytes: containerMemoryLimitBytes(read),
    uptimeSeconds: process.uptime(),
  };
}

const mb = (bytes: number): number => Math.round(bytes / (1024 * 1024));

/**
 * One greppable line per sample. Whole MiB throughout: a leak worth chasing
 * moves these by hundreds, and byte counts only make the line harder to read.
 */
export function formatMemorySample(sample: MemorySample): string {
  return [
    "[memory]",
    `rssMb=${mb(sample.rssBytes)}`,
    `heapUsedMb=${mb(sample.heapUsedBytes)}`,
    `heapTotalMb=${mb(sample.heapTotalBytes)}`,
    `heapLimitMb=${mb(sample.heapLimitBytes)}`,
    `containerLimitMb=${
      sample.containerLimitBytes === null ? "unknown" : mb(sample.containerLimitBytes)
    }`,
    `externalMb=${mb(sample.externalBytes)}`,
    `arrayBuffersMb=${mb(sample.arrayBuffersBytes)}`,
    `uptimeSec=${Math.round(sample.uptimeSeconds)}`,
  ].join(" ");
}

/**
 * Start reporting memory on an interval. Returns the timer, or null when
 * reporting is switched off.
 *
 * The first sample is taken immediately rather than one interval later, so the
 * log stream carries a line with `uptimeSec≈0` for every boot — which is what
 * makes a deploy distinguishable from a crash after the fact.
 *
 * The timer is unref'd, so it never keeps the process alive, and a reporting
 * failure is swallowed: a diagnostic that can take down the web server is worse
 * than no diagnostic.
 */
export function startMemoryReporter({
  env = process.env,
  log = console.log,
  read = readLimitFile,
}: {
  env?: Readonly<Record<string, string | undefined>>;
  log?: (line: string) => void;
  read?: LimitFileReader;
} = {}): NodeJS.Timeout | null {
  const intervalMs = reportIntervalMs(env);
  if (intervalMs === 0) return null;

  const report = () => {
    try {
      log(formatMemorySample(sampleMemory(read)));
    } catch {
      // Nothing useful to do about a failed report, and nothing that goes wrong
      // here is worth surfacing through the process it is only observing.
    }
  };

  report();
  const timer = setInterval(report, intervalMs);
  timer.unref();
  return timer;
}
