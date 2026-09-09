import { describe, expect, it } from "vitest";

import {
  MIN_CONTAINER_LIMIT_BYTES,
  OLD_SPACE_FRACTION,
  containerMemoryLimitBytes,
  oldSpaceFlag,
  parseCgroupLimit,
  resolveOldSpaceMb,
} from "@/lib/heap-limit";

const MiB = 1024 * 1024;

describe("parseCgroupLimit", () => {
  it("reads a byte count", () => {
    expect(parseCgroupLimit("2147483648\n")).toBe(2147483648);
  });

  it("treats cgroup v2's `max` as no limit", () => {
    expect(parseCgroupLimit("max\n")).toBeNull();
  });

  it("treats cgroup v1's unlimited sentinel as no limit", () => {
    // v1 publishes a near-INT64_MAX value rather than a word when uncapped.
    expect(parseCgroupLimit("9223372036854771712")).toBeNull();
  });

  it("rejects anything that is not a plain byte count", () => {
    for (const raw of ["", "  ", "-1", "1.5", "1e9", "abc"]) {
      expect(parseCgroupLimit(raw)).toBeNull();
    }
  });

  it("reports no limit when the file is absent", () => {
    expect(parseCgroupLimit(null)).toBeNull();
  });
});

describe("containerMemoryLimitBytes", () => {
  it("prefers cgroup v2", () => {
    const limit = containerMemoryLimitBytes((path) =>
      path === "/sys/fs/cgroup/memory.max" ? "1073741824" : "536870912",
    );
    expect(limit).toBe(1073741824);
  });

  it("falls back to cgroup v1 when v2 is absent", () => {
    const limit = containerMemoryLimitBytes((path) =>
      path === "/sys/fs/cgroup/memory/memory.limit_in_bytes" ? "536870912" : null,
    );
    expect(limit).toBe(536870912);
  });

  it("falls back to v1 when v2 reports no limit", () => {
    const limit = containerMemoryLimitBytes((path) =>
      path === "/sys/fs/cgroup/memory.max" ? "max" : "536870912",
    );
    expect(limit).toBe(536870912);
  });

  it("reports no limit off a container", () => {
    expect(containerMemoryLimitBytes(() => null)).toBeNull();
  });
});

describe("resolveOldSpaceMb", () => {
  it("leaves headroom for everything that is not the JS heap", () => {
    // Buffers, the Prisma query engine, TLS, and code all live outside old space.
    expect(resolveOldSpaceMb(2048 * MiB)).toBe(Math.floor(2048 * OLD_SPACE_FRACTION));
  });

  it("declines to size an unknown limit", () => {
    expect(resolveOldSpaceMb(null)).toBeNull();
  });

  it("declines to size a container too small to spend headroom on", () => {
    expect(resolveOldSpaceMb(MIN_CONTAINER_LIMIT_BYTES - 1)).toBeNull();
  });

  it("sizes a container exactly at the floor", () => {
    expect(resolveOldSpaceMb(MIN_CONTAINER_LIMIT_BYTES)).toBeGreaterThan(0);
  });
});

describe("oldSpaceFlag", () => {
  it("builds the flag from the container limit", () => {
    expect(oldSpaceFlag({}, 2048 * MiB)).toBe(
      `--max-old-space-size=${Math.floor(2048 * OLD_SPACE_FRACTION)}`,
    );
  });

  it("yields to an operator who already set the flag", () => {
    // An explicit NODE_OPTIONS is a deliberate override; silently widening or
    // narrowing it would make the deployed heap ceiling unpredictable.
    expect(
      oldSpaceFlag({ NODE_OPTIONS: "--max-old-space-size=512" }, 2048 * MiB),
    ).toBeNull();
  });

  it("yields to the flag whatever else NODE_OPTIONS carries", () => {
    expect(
      oldSpaceFlag(
        { NODE_OPTIONS: "--enable-source-maps --max-old-space-size=512" },
        2048 * MiB,
      ),
    ).toBeNull();
  });

  it("still sets the flag alongside unrelated NODE_OPTIONS", () => {
    expect(oldSpaceFlag({ NODE_OPTIONS: "--enable-source-maps" }, 2048 * MiB)).toBe(
      `--max-old-space-size=${Math.floor(2048 * OLD_SPACE_FRACTION)}`,
    );
  });

  it("adds nothing when the limit is unknown", () => {
    expect(oldSpaceFlag({}, null)).toBeNull();
  });
});
