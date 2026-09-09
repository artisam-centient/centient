import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_REPORT_INTERVAL_MS,
  formatMemorySample,
  reportIntervalMs,
  sampleMemory,
  startMemoryReporter,
  type MemorySample,
} from "@/lib/memory-report";

const SAMPLE: MemorySample = {
  rssBytes: 1_500_000_000,
  heapUsedBytes: 900_000_000,
  heapTotalBytes: 1_100_000_000,
  externalBytes: 40_000_000,
  arrayBuffersBytes: 8_000_000,
  heapLimitBytes: 4_345_298_944,
  containerLimitBytes: 2_147_483_648,
  uptimeSeconds: 3600.4,
};

const noLimitFiles = () => null;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("reportIntervalMs", () => {
  it("defaults when unset", () => {
    expect(reportIntervalMs({})).toBe(DEFAULT_REPORT_INTERVAL_MS);
  });

  it("takes a configured interval", () => {
    expect(reportIntervalMs({ MEMORY_REPORT_INTERVAL_MS: "30000" })).toBe(30_000);
  });

  it("treats zero as off", () => {
    expect(reportIntervalMs({ MEMORY_REPORT_INTERVAL_MS: "0" })).toBe(0);
  });

  it("falls back on a malformed interval rather than reporting nothing", () => {
    // A typo must not silently disable the only signal that distinguishes a
    // leak from ordinary heap growth.
    for (const raw of ["", "-1", "1.5", "soon", "60_000"]) {
      expect(reportIntervalMs({ MEMORY_REPORT_INTERVAL_MS: raw })).toBe(
        DEFAULT_REPORT_INTERVAL_MS,
      );
    }
  });
});

describe("formatMemorySample", () => {
  it("reports every figure needed to tell retention from heap growth", () => {
    const line = formatMemorySample(SAMPLE);
    expect(line).toContain("[memory]");
    expect(line).toContain("rssMb=1431");
    expect(line).toContain("heapUsedMb=858");
    expect(line).toContain("heapTotalMb=1049");
    expect(line).toContain("externalMb=38");
    expect(line).toContain("arrayBuffersMb=8");
  });

  it("puts V8's ceiling next to the container's", () => {
    // Side by side these say whether V8 has any reason to collect before the
    // platform kills the container. Here it does not: 4144 > 2048.
    const line = formatMemorySample(SAMPLE);
    expect(line).toContain("heapLimitMb=4144");
    expect(line).toContain("containerLimitMb=2048");
  });

  it("says so rather than guessing when there is no container limit", () => {
    const line = formatMemorySample({ ...SAMPLE, containerLimitBytes: null });
    expect(line).toContain("containerLimitMb=unknown");
  });

  it("reports uptime, which is what a deploy resets", () => {
    expect(formatMemorySample(SAMPLE)).toContain("uptimeSec=3600");
  });

  it("stays one greppable line", () => {
    expect(formatMemorySample(SAMPLE)).not.toContain("\n");
  });
});

describe("sampleMemory", () => {
  it("reads this process's live figures", () => {
    const sample = sampleMemory(noLimitFiles);
    expect(sample.heapUsedBytes).toBeGreaterThan(0);
    expect(sample.heapTotalBytes).toBeGreaterThanOrEqual(sample.heapUsedBytes);
    expect(sample.heapLimitBytes).toBeGreaterThan(0);
    expect(sample.uptimeSeconds).toBeGreaterThan(0);
  });

  it("reports no container limit off a container", () => {
    expect(sampleMemory(noLimitFiles).containerLimitBytes).toBeNull();
  });

  it("reports the container limit when one is published", () => {
    const sample = sampleMemory((path) =>
      path === "/sys/fs/cgroup/memory.max" ? "2147483648" : null,
    );
    expect(sample.containerLimitBytes).toBe(2_147_483_648);
  });
});

describe("startMemoryReporter", () => {
  it("reports once at boot, then on the interval", () => {
    vi.useFakeTimers();
    const log = vi.fn();
    const timer = startMemoryReporter({
      env: { MEMORY_REPORT_INTERVAL_MS: "1000" },
      log,
      read: noLimitFiles,
    });

    // The boot line is what dates a restart in the log stream.
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain("[memory]");

    vi.advanceTimersByTime(3_000);
    expect(log).toHaveBeenCalledTimes(4);

    clearInterval(timer!);
  });

  it("is switched off by a zero interval", () => {
    vi.useFakeTimers();
    const log = vi.fn();
    const timer = startMemoryReporter({
      env: { MEMORY_REPORT_INTERVAL_MS: "0" },
      log,
      read: noLimitFiles,
    });

    vi.advanceTimersByTime(600_000);
    expect(timer).toBeNull();
    expect(log).not.toHaveBeenCalled();
  });

  it("never holds the process open", () => {
    // The reporter is a diagnostic, not work: a shutting-down worker must not
    // wait on it, and neither must a test runner.
    const timer = startMemoryReporter({ env: {}, log: vi.fn(), read: noLimitFiles });
    expect(timer).not.toBeNull();
    expect(timer!.hasRef()).toBe(false);
    clearInterval(timer!);
  });

  it("survives a reporting failure rather than killing the caller", () => {
    vi.useFakeTimers();
    const log = vi.fn(() => {
      throw new Error("stdout gone");
    });
    const timer = startMemoryReporter({
      env: { MEMORY_REPORT_INTERVAL_MS: "1000" },
      log,
      read: noLimitFiles,
    });

    expect(() => vi.advanceTimersByTime(2_000)).not.toThrow();
    clearInterval(timer!);
  });
});
